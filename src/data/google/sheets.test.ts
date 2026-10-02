import { fakeFetch, googleError, json } from '../../test/fakeFetch';
import { tx } from '../../test/fixtures';
import { AppError } from '../errors';
import { createGoogleClient } from './http';
import { GoogleLedgerRepository, connectLedger, createLedger } from './repository';
import { TABS } from './schema';
import { inspectSpreadsheet, prepareSpreadsheet } from './sheets';

const ID = 'sheet-abc';
const mk = (routes: Parameters<typeof fakeFetch>[0]) => {
  const f = fakeFetch(routes);
  return { client: createGoogleClient({ getToken: () => 'tok', fetchImpl: f.impl, sleep: () => Promise.resolve() }), calls: f.calls };
};

describe('creating a finance sheet', () => {
  it('creates all tabs with headers and defaults, formats columns, files it under MyXPNS and tags it', async () => {
    const { client, calls } = mk([
      ['POST', /sheets\.googleapis\.com\/v4\/spreadsheets\?/, () => json({ spreadsheetId: ID, spreadsheetUrl: 'https://docs.google.com/x' })],
      ['POST', /:batchUpdate$/, () => json({})],
      ['GET', /drive\/v3\/files\?q=/, () => json({ files: [] })],
      ['POST', /drive\/v3\/files\?fields=id/, () => json({ id: 'folder-myxpns' })],
      ['GET', /drive\/v3\/files\/sheet-abc\?fields=parents/, () => json({ parents: ['root-id'] })],
      ['PATCH', /drive\/v3\/files\/sheet-abc/, () => json({ id: ID })],
    ]);
    await expect(createLedger(client)).resolves.toBe(ID);

    const create = calls[0]!.body as { sheets: { properties: { title: string }; data: { rowData: { values: { userEnteredValue: Record<string, unknown> }[] }[] }[] }[] };
    expect(create.sheets.map((s) => s.properties.title)).toEqual(['Transactions', 'Categories', 'Merchant_Rules', 'Payment_Methods', 'Settings']);
    const headerOf = (i: number) => create.sheets[i]!.data[0]!.rowData[0]!.values.map((v) => v.userEnteredValue.stringValue);
    expect(headerOf(0)).toEqual(TABS.transactions.headers);
    expect(create.sheets[1]!.data[0]!.rowData).toHaveLength(1 + 18); // header + default categories
    expect(create.sheets[0]!.data[0]!.rowData).toHaveLength(1); // no fake transactions

    const folderCreate = calls.find((c) => c.method === 'POST' && c.url.includes('drive/v3/files?fields=id'))!;
    expect(folderCreate.body).toEqual({ name: 'MyXPNS', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] });
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.url).toContain('addParents=folder-myxpns');
    expect(patch.url).toContain('removeParents=root-id');
    expect(patch.body).toEqual({ appProperties: { myxpns: 'ledger' } });
  });
});

describe('connecting an existing sheet', () => {
  const meta = (titles: string[]) => json({ spreadsheetUrl: 'u', properties: { title: 'Family' }, sheets: titles.map((t, i) => ({ properties: { sheetId: i, title: t } })) });

  it('reports missing tabs and refuses tabs with different columns', async () => {
    const { client } = mk([
      ['GET', /fields=spreadsheetUrl/, () => meta(['Transactions', 'Categories', 'Notes'])],
      ['GET', /values:batchGet/, () => json({ valueRanges: [{ values: [['Date', 'Amount']] }, { values: [] }] })],
    ]);
    const r = await inspectSpreadsheet(client, ID);
    expect(r.missing).toEqual(['merchantRules', 'paymentMethods', 'settings']);
    expect(r.empty).toEqual(['categories']);
    expect(r.problems).toEqual(['The “Transactions” tab has different columns than MyXPNS expects.']);
    await expect(prepareSpreadsheet(client, ID, r)).rejects.toMatchObject({ kind: 'invalid_ledger' });
  });

  it('adds only missing tabs and never rewrites existing ones', async () => {
    const { client, calls } = mk([
      ['GET', /fields=spreadsheetUrl/, () => meta(['Transactions'])],
      ['GET', /values:batchGet/, () => json({ valueRanges: [{ values: [TABS.transactions.headers] }] })],
      ['POST', /values:batchUpdate$/, () => json({})],
      ['POST', /sheet-abc:batchUpdate$/, (req) => json({ replies: (req.body as { requests: unknown[] }).requests.map((_, i) => ({ addSheet: { properties: { sheetId: 10 + i } } })) })],
      ['PATCH', /drive\/v3\/files/, () => googleError(403)], // tagging fails for non-owners: must not block
    ]);
    const r = await inspectSpreadsheet(client, ID);
    expect(r.problems).toEqual([]);
    await connectLedger(client, ID, r);
    const write = calls.find((c) => c.url.endsWith('values:batchUpdate'))!.body as { valueInputOption: string; data: { range: string }[] };
    expect(write.valueInputOption).toBe('RAW');
    expect(write.data.map((d) => d.range)).toEqual(['Categories!A1', 'Merchant_Rules!A1', 'Payment_Methods!A1', 'Settings!A1']);
    // The Transactions tab (which has data) is only read, never written or reformatted.
    expect(calls.some((c) => c.method !== 'GET' && decodeURIComponent(c.url).includes('Transactions'))).toBe(false);
    expect(calls.filter((c) => c.url.endsWith(`${ID}:batchUpdate`))).toHaveLength(1); // addSheet only, no formatting
  });
});

describe('GoogleLedgerRepository', () => {
  it('loads the whole ledger in one request and skips unreadable rows', async () => {
    const { client, calls } = mk([
      [
        'GET',
        /values:batchGet/,
        () =>
          json({
            valueRanges: [
              { values: [['TX-1', 46298, 'SPENT', 2350, 'Groceries', 'DMart', 'UPI', '', '', '2026-10-03T10:00:00Z', 'a@x.com'], [], ['broken']] },
              { values: [['Groceries', 'SPENT', true]] },
              { values: [['DMart', 'D-Mart', 'Groceries']] },
              { values: [['UPI', true]] },
              { values: [['Currency', 'INR']] },
            ],
          }),
      ],
    ]);
    const data = await new GoogleLedgerRepository(client, ID).load();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('valueRenderOption=UNFORMATTED_VALUE');
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]).toMatchObject({ date: '2026-10-03', amount: 2350, merchant: 'DMart' });
    expect(data.skippedRows).toBe(1);
    expect(data.merchantRules[0]!.aliases).toEqual(['D-Mart']);
  });

  it('appends transactions with RAW input', async () => {
    const { client, calls } = mk([['POST', /:append/, () => json({})]]);
    const t = tx({ date: '2026-10-03', type: 'RECEIVED', amount: 100, category: 'Donations', merchant: 'Donor' });
    await new GoogleLedgerRepository(client, ID).appendTransaction(t);
    expect(calls[0]!.url).toContain('valueInputOption=RAW');
    expect(calls[0]!.url).toContain(encodeURIComponent('Transactions!A1'));
    expect((calls[0]!.body as { values: unknown[][] }).values[0]![2]).toBe('RECEIVED');
  });

  it('updates an existing merchant rule in place', async () => {
    const { client, calls } = mk([
      ['GET', /Merchant_Rules/, () => json({ values: [['Swiggy', '', 'Dining'], ['DMart', 'Avenue Supermarts', 'Groceries']] })],
      ['PUT', /Merchant_Rules/, () => json({})],
    ]);
    const rules = await new GoogleLedgerRepository(client, ID).saveMerchantRule('D-Mart', 'Household');
    expect(decodeURIComponent(calls[1]!.url)).toContain('Merchant_Rules!C3');
    expect(calls[1]!.body).toEqual({ values: [['Household']] });
    expect(rules[1]).toEqual({ merchant: 'DMart', aliases: ['Avenue Supermarts'], category: 'Household' });
  });

  it('appends a new merchant rule', async () => {
    const { client, calls } = mk([
      ['GET', /Merchant_Rules/, () => json({})],
      ['POST', /:append/, () => json({})],
    ]);
    const rules = await new GoogleLedgerRepository(client, ID).saveMerchantRule('Raju Barber', 'Personal Care');
    expect(rules).toEqual([{ merchant: 'Raju Barber', aliases: [], category: 'Personal Care' }]);
    expect(calls[1]!.body).toEqual({ values: [['Raju Barber', '', 'Personal Care']] });
  });

  it('uploads receipts into MyXPNS/Receipts/YYYY/MM-Month and reuses folders', async () => {
    let folderN = 0;
    const { client, calls } = mk([
      ['GET', /drive\/v3\/files\?q=/, () => json({ files: [] })],
      ['POST', /drive\/v3\/files\?fields=id/, () => json({ id: `f${++folderN}` })],
      ['POST', /upload\/drive\/v3\/files\?uploadType=multipart/, () => json({ id: 'file-1', webViewLink: 'https://drive.google.com/file/d/file-1/view' })],
    ]);
    const repo = new GoogleLedgerRepository(client, ID);
    const meta = { fileName: '2026-10-03_DMart_1250.jpg', date: '2026-10-03', mimeType: 'image/jpeg' };
    await expect(repo.uploadReceipt(new Blob(['img']), meta)).resolves.toEqual({ fileId: 'file-1', url: 'https://drive.google.com/file/d/file-1/view' });
    const created = calls.filter((c) => c.url.includes('files?fields=id')).map((c) => (c.body as { name: string; parents: string[] }));
    expect(created).toEqual([
      expect.objectContaining({ name: 'MyXPNS', parents: ['root'] }),
      expect.objectContaining({ name: 'Receipts', parents: ['f1'] }),
      expect.objectContaining({ name: '2026', parents: ['f2'] }),
      expect.objectContaining({ name: '10-October', parents: ['f3'] }),
    ]);
    const upload = calls.find((c) => c.url.includes('uploadType=multipart'))!;
    expect(upload.headers['Content-Type']).toMatch(/^multipart\/related; boundary=/);
    const text = await (upload.body as Blob).text();
    expect(text).toContain('"name":"2026-10-03_DMart_1250.jpg"');
    expect(text).toContain('"parents":["f4"]');

    calls.length = 0;
    await repo.uploadReceipt(new Blob(['img2']), meta);
    expect(calls.map((c) => c.method + ' ' + c.url.split('?')[0])).toEqual(['POST https://www.googleapis.com/upload/drive/v3/files']);
  });

  it('surfaces upload failures as AppErrors and does not cache failed folders', async () => {
    let fail = true;
    const { client } = mk([
      ['GET', /drive\/v3\/files\?q=/, () => (fail ? 'network-error' : json({ files: [{ id: 'existing' }] }))],
      ['POST', /upload/, () => json({ id: 'file-2' })],
    ]);
    const repo = new GoogleLedgerRepository(client, ID);
    const meta = { fileName: 'r.jpg', date: '2026-10-03', mimeType: 'image/jpeg' };
    await expect(repo.uploadReceipt(new Blob(['x']), meta)).rejects.toBeInstanceOf(AppError);
    fail = false;
    await expect(repo.uploadReceipt(new Blob(['x']), meta)).resolves.toMatchObject({ fileId: 'file-2' });
  });
});

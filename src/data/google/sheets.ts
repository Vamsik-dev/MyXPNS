import { DEFAULT_CATEGORIES, DEFAULT_MERCHANT_RULES, DEFAULT_PAYMENT_METHODS, DEFAULT_SETTINGS } from '../../domain/defaults';
import { merchantKey } from '../../domain/merchants';
import type { LedgerData, MerchantRule, Transaction } from '../../domain/types';
import { AppError } from '../errors';
import type { GoogleClient } from './http';
import type { TabKey } from './schema';
import {
  TABS,
  TAB_KEYS,
  categoryToRow,
  dataRange,
  headerRange,
  isBlankRow,
  merchantRuleToRow,
  paymentMethodToRow,
  rowToCategory,
  rowToMerchantRule,
  rowToPaymentMethod,
  rowToTransaction,
  rowsToSettings,
  settingsToRows,
  transactionToRow,
} from './schema';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

type Cell = string | number | boolean;
type ValueRange = { range: string; values?: Cell[][] };

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function defaultRows(tab: TabKey, createdAt: string): Cell[][] {
  switch (tab) {
    case 'categories':
      return DEFAULT_CATEGORIES.map(categoryToRow);
    case 'paymentMethods':
      return DEFAULT_PAYMENT_METHODS.map(paymentMethodToRow);
    case 'merchantRules':
      return DEFAULT_MERCHANT_RULES.map(merchantRuleToRow);
    case 'settings':
      return settingsToRows(DEFAULT_SETTINGS, createdAt);
    case 'transactions':
      return [];
  }
}

function toCellData(value: Cell, bold = false) {
  const userEnteredValue =
    typeof value === 'number' ? { numberValue: value } : typeof value === 'boolean' ? { boolValue: value } : { stringValue: value };
  return bold ? { userEnteredValue, userEnteredFormat: { textFormat: { bold: true } } } : { userEnteredValue };
}

/** Date column as yyyy-mm-dd and Amount with thousands separators. */
function transactionFormatRequests(sheetId: number) {
  const col = (index: number, numberFormat: object) => ({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: index, endColumnIndex: index + 1 },
      cell: { userEnteredFormat: { numberFormat } },
      fields: 'userEnteredFormat.numberFormat',
    },
  });
  return [col(1, { type: 'DATE', pattern: 'yyyy-mm-dd' }), col(3, { type: 'NUMBER', pattern: '#,##0.00' })];
}

/** Creates a brand-new workbook with all tabs, headers and editable defaults. */
export async function createSpreadsheet(client: GoogleClient, title: string, now = new Date()): Promise<{ id: string; url: string }> {
  const createdAt = now.toISOString();
  const sheets = TAB_KEYS.map((key, index) => ({
    properties: { sheetId: index, title: TABS[key].title, index, gridProperties: { frozenRowCount: 1 } },
    data: [
      {
        startRow: 0,
        startColumn: 0,
        rowData: [
          { values: TABS[key].headers.map((h) => toCellData(h, true)) },
          ...defaultRows(key, createdAt).map((r) => ({ values: r.map((c) => toCellData(c)) })),
        ],
      },
    ],
  }));
  const created = await client.request<{ spreadsheetId: string; spreadsheetUrl: string }>(
    `${SHEETS}?fields=spreadsheetId,spreadsheetUrl`,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ properties: { title }, sheets }) },
  );
  await client.request(`${SHEETS}/${created.spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ requests: transactionFormatRequests(0) }),
  });
  return { id: created.spreadsheetId, url: created.spreadsheetUrl };
}

export interface LedgerInspection {
  title: string;
  url: string;
  /** Tabs that don't exist yet and will be added. */
  missing: TabKey[];
  /** Tabs that exist but are empty (headers will be written). */
  empty: TabKey[];
  /** Human-readable reasons this spreadsheet cannot be used safely. */
  problems: string[];
  sheetIds: Partial<Record<TabKey, number>>;
}

/**
 * Checks whether a spreadsheet can be used as a MyXPNS ledger without destroying anything.
 * Existing tabs must have the expected headers; we never rewrite tabs that contain other data.
 */
export async function inspectSpreadsheet(client: GoogleClient, id: string): Promise<LedgerInspection> {
  const meta = await client.request<{ spreadsheetUrl: string; properties: { title: string }; sheets: { properties: { sheetId: number; title: string } }[] }>(
    `${SHEETS}/${encodeURIComponent(id)}?fields=spreadsheetUrl,properties.title,sheets.properties(sheetId,title)`,
  );
  const sheetIds: Partial<Record<TabKey, number>> = {};
  const present: TabKey[] = [];
  const missing: TabKey[] = [];
  for (const key of TAB_KEYS) {
    const sheet = meta.sheets.find((s) => s.properties.title === TABS[key].title);
    if (sheet) {
      sheetIds[key] = sheet.properties.sheetId;
      present.push(key);
    } else missing.push(key);
  }
  const empty: TabKey[] = [];
  const problems: string[] = [];
  if (present.length) {
    const params = new URLSearchParams();
    present.forEach((k) => params.append('ranges', headerRange(k)));
    const res = await client.request<{ valueRanges: ValueRange[] }>(`${SHEETS}/${encodeURIComponent(id)}/values:batchGet?${params}`);
    present.forEach((key, i) => {
      const row = (res.valueRanges[i]?.values?.[0] ?? []).map((c) => String(c).trim().toLowerCase());
      if (row.every((c) => c === '')) {
        empty.push(key);
        return;
      }
      const expected = TABS[key].headers.map((h) => h.toLowerCase());
      if (expected.some((h, idx) => row[idx] !== h)) {
        problems.push(`The “${TABS[key].title}” tab has different columns than MyXPNS expects.`);
      }
    });
  }
  return { title: meta.properties.title, url: meta.spreadsheetUrl, missing, empty, problems, sheetIds };
}

/** Adds missing tabs and headers. Only touches tabs that are missing or completely empty. */
export async function prepareSpreadsheet(client: GoogleClient, id: string, inspection: LedgerInspection, now = new Date()): Promise<void> {
  if (inspection.problems.length) throw new AppError('invalid_ledger', inspection.problems.join(' '));
  const sheetIds = { ...inspection.sheetIds };
  if (inspection.missing.length) {
    const res = await client.request<{ replies: { addSheet: { properties: { sheetId: number; title: string } } }[] }>(
      `${SHEETS}/${encodeURIComponent(id)}:batchUpdate`,
      {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          requests: inspection.missing.map((key) => ({ addSheet: { properties: { title: TABS[key].title, gridProperties: { frozenRowCount: 1 } } } })),
        }),
      },
    );
    inspection.missing.forEach((key, i) => {
      sheetIds[key] = res.replies[i]!.addSheet.properties.sheetId;
    });
  }
  const toFill = [...inspection.missing, ...inspection.empty];
  if (toFill.length) {
    const createdAt = now.toISOString();
    await client.request(`${SHEETS}/${encodeURIComponent(id)}/values:batchUpdate`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: toFill.map((key) => ({ range: `${TABS[key].title}!A1`, values: [[...TABS[key].headers], ...defaultRows(key, createdAt)] })),
      }),
    });
  }
  if (toFill.includes('transactions') && sheetIds.transactions !== undefined) {
    await client.request(`${SHEETS}/${encodeURIComponent(id)}:batchUpdate`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ requests: transactionFormatRequests(sheetIds.transactions) }),
    });
  }
}

/** Reads the whole ledger in a single API call. */
export async function readLedger(client: GoogleClient, id: string): Promise<LedgerData> {
  const params = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
  TAB_KEYS.forEach((k) => params.append('ranges', dataRange(k)));
  const res = await client.request<{ valueRanges: ValueRange[] }>(`${SHEETS}/${encodeURIComponent(id)}/values:batchGet?${params}`);
  const rows = (key: TabKey) => res.valueRanges[TAB_KEYS.indexOf(key)]?.values ?? [];

  let skippedRows = 0;
  const transactions: Transaction[] = [];
  for (const row of rows('transactions')) {
    if (isBlankRow(row)) continue;
    const tx = rowToTransaction(row);
    if (tx) transactions.push(tx);
    else skippedRows++;
  }
  const defined = <T,>(x: T | undefined): x is T => x !== undefined;
  return {
    transactions,
    categories: rows('categories').map(rowToCategory).filter(defined),
    paymentMethods: rows('paymentMethods').map(rowToPaymentMethod).filter(defined),
    merchantRules: rows('merchantRules').map(rowToMerchantRule).filter(defined),
    settings: rowsToSettings(rows('settings'), DEFAULT_SETTINGS),
    skippedRows,
  };
}

export async function appendRow(client: GoogleClient, id: string, tab: TabKey, row: Cell[]): Promise<void> {
  const range = encodeURIComponent(`${TABS[tab].title}!A1`);
  await client.request(`${SHEETS}/${encodeURIComponent(id)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: JSON_HEADERS,
    // RAW: text is stored exactly as typed, so a merchant like "=HYPERLINK(...)" can never become a formula.
    body: JSON.stringify({ values: [row] }),
  });
}

export async function appendTransaction(client: GoogleClient, id: string, tx: Transaction): Promise<void> {
  await appendRow(client, id, 'transactions', transactionToRow(tx));
}

export async function transactionExists(client: GoogleClient, id: string, txId: string): Promise<boolean> {
  const range = encodeURIComponent(`${TABS.transactions.title}!A2:A`);
  const res = await client.request<ValueRange>(`${SHEETS}/${encodeURIComponent(id)}/values/${range}`);
  return (res.values ?? []).some((r) => String(r[0] ?? '').trim() === txId);
}

/** Re-reads Merchant_Rules, then updates the matching row's category or appends a new rule. */
export async function upsertMerchantRule(client: GoogleClient, id: string, merchant: string, category: string): Promise<MerchantRule[]> {
  const range = encodeURIComponent(dataRange('merchantRules'));
  const res = await client.request<ValueRange>(`${SHEETS}/${encodeURIComponent(id)}/values/${range}`);
  const rows = res.values ?? [];
  const key = merchantKey(merchant);
  const rowIndex = rows.findIndex((r) => {
    const rule = rowToMerchantRule(r);
    return rule !== undefined && [rule.merchant, ...rule.aliases].some((n) => merchantKey(n) === key);
  });
  if (rowIndex >= 0) {
    const cell = encodeURIComponent(`${TABS.merchantRules.title}!C${rowIndex + 2}`);
    await client.request(`${SHEETS}/${encodeURIComponent(id)}/values/${cell}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ values: [[category]] }),
    });
    const updated = rows.slice();
    const row = (updated[rowIndex] ?? []).slice();
    row[2] = category;
    updated[rowIndex] = row;
    return updated.map(rowToMerchantRule).filter((r): r is MerchantRule => r !== undefined);
  }
  const rule: MerchantRule = { merchant, aliases: [], category };
  await appendRow(client, id, 'merchantRules', merchantRuleToRow(rule));
  return [...rows.map(rowToMerchantRule).filter((r): r is MerchantRule => r !== undefined), rule];
}

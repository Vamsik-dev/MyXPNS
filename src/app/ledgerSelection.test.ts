import { createGoogleClient } from '../data/google/http';
import { AppError } from '../data/errors';
import { memoryStore, prefs } from '../lib/storage';
import { fakeFetch, json } from '../test/fakeFetch';
import { chooseLedgerId, isLedgerUnavailable } from './ledgerSelection';

function client(files: { id: string; name: string }[]) {
  const f = fakeFetch([['GET', /drive\/v3\/files\?q=/, () => json({ files })]]);
  return { c: createGoogleClient({ getToken: () => 't', fetchImpl: f.impl }), calls: f.calls };
}

describe('ledger selection', () => {
  it('remembers the ledger per Google account (no cross-account leakage)', async () => {
    const store = memoryStore();
    prefs.setLedgerId(store, 'Alice@example.com', 'sheet-alice');
    const { c, calls } = client([]);
    await expect(chooseLedgerId(c, store, 'alice@example.com')).resolves.toBe('sheet-alice');
    expect(calls).toHaveLength(0);
    await expect(chooseLedgerId(c, store, 'bob@example.com')).resolves.toBeUndefined();
    expect(prefs.ledgerId(store, 'bob@example.com')).toBeNull();
  });

  it('discovers a ledger MyXPNS created earlier (e.g. on another device)', async () => {
    const store = memoryStore();
    const { c, calls } = client([{ id: 'sheet-1', name: 'MyXPNS Ledger' }]);
    await expect(chooseLedgerId(c, store, 'me@example.com')).resolves.toBe('sheet-1');
    expect(new URL(calls[0]!.url).searchParams.get('q')).toContain("appProperties has { key='myxpns' and value='ledger' }");
    expect(prefs.ledgerId(store, 'me@example.com')).toBe('sheet-1');
  });

  it('treats not_found/forbidden as an unavailable ledger', () => {
    expect(isLedgerUnavailable(new AppError('forbidden', ''))).toBe(true);
    expect(isLedgerUnavailable(new AppError('not_found', ''))).toBe(true);
    expect(isLedgerUnavailable(new AppError('network', ''))).toBe(false);
  });
});

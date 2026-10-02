import { tx } from '../../test/fixtures';
import { dataRange, headerRange, parseBool, parseSheetDate, rowToCategory, rowToMerchantRule, rowToTransaction, rowsToSettings, transactionToRow } from './schema';
import { DEFAULT_SETTINGS } from '../../domain/defaults';

describe('sheet schema', () => {
  it('has the documented Transactions columns', () => {
    expect(dataRange('transactions')).toBe('Transactions!A2:K');
    expect(headerRange('settings')).toBe('Settings!A1:B1');
  });

  it('round-trips a transaction through a row', () => {
    const t = tx({ date: '2026-10-03', type: 'SPENT', amount: 1250.5, category: 'Groceries', merchant: 'DMart', notes: 'weekly' });
    const row = transactionToRow(t);
    expect(row[1]).toBe(46298); // Sheets serial date
    expect(rowToTransaction(row)).toEqual(t);
  });

  it('keeps formula-looking text as text (written with valueInputOption=RAW)', () => {
    const t = tx({ date: '2026-10-03', type: 'SPENT', amount: 1, category: 'Other Expense', merchant: '=IMPORTXML("http://evil")' });
    expect(transactionToRow(t)[5]).toBe('=IMPORTXML("http://evil")');
  });

  it('reads hand-entered rows leniently', () => {
    const t = rowToTransaction(['TX-1', '03/10/2026', 'spent', '1,250', '', 'Shop']);
    expect(t).toMatchObject({ id: 'TX-1', date: '2026-10-03', type: 'SPENT', amount: 1250, category: 'Uncategorized', merchant: 'Shop', receiptUrl: '' });
  });

  it.each([
    [['', 46298, 'SPENT', 10]],
    [['TX-1', 'yesterday', 'SPENT', 10]],
    [['TX-1', 46298, 'TRANSFER', 10]],
    [['TX-1', 46298, 'SPENT', 0]],
    [['TX-1', 46298, 'SPENT', 'ten']],
  ])('skips untrustworthy row %j', (row) => {
    expect(rowToTransaction(row)).toBeUndefined();
  });

  it('parses dates, booleans, categories, rules and settings', () => {
    expect(parseSheetDate('2026-10-03')).toBe('2026-10-03');
    expect(parseSheetDate('31/02/2026')).toBeUndefined();
    expect(parseBool('', true)).toBe(true);
    expect(parseBool('FALSE', true)).toBe(false);
    expect(parseBool(false, true)).toBe(false);
    expect(rowToCategory(['Milk', '', ''])).toEqual({ name: 'Milk', kind: 'BOTH', active: true });
    expect(rowToCategory(['Maid', 'spent', 'no'])).toEqual({ name: 'Maid', kind: 'SPENT', active: false });
    expect(rowToMerchantRule(['DMart', 'D-Mart; Avenue Supermarts ,', 'Groceries'])).toEqual({
      merchant: 'DMart',
      aliases: ['D-Mart', 'Avenue Supermarts'],
      category: 'Groceries',
    });
    expect(rowsToSettings([['Currency', 'usd'], ['Ledger Name', 'Pathashala']], DEFAULT_SETTINGS)).toEqual({ currency: 'INR', ledgerName: 'Pathashala' });
  });
});

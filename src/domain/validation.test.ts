import { categories, paymentMethods, TODAY } from '../test/fixtures';
import type { TransactionInput } from './validation';
import { categoriesFor, cleanText, validateTransaction } from './validation';

const ctx = { categories, paymentMethods, today: TODAY };
const spent: TransactionInput = { type: 'SPENT', amount: '1,250', date: TODAY, category: 'Groceries', merchant: ' DMart ', paymentMethod: 'UPI', notes: '' };

describe('validateTransaction', () => {
  it('accepts a valid expense and normalizes values', () => {
    const r = validateTransaction(spent, ctx);
    expect(r).toEqual({
      ok: true,
      value: { type: 'SPENT', amount: 1250, date: TODAY, category: 'Groceries', merchant: 'DMart', paymentMethod: 'UPI', notes: '' },
    });
  });

  it('accepts a valid received transaction with a received-only category', () => {
    const r = validateTransaction({ ...spent, type: 'RECEIVED', amount: '250000', category: 'Salary', merchant: '' }, ctx);
    expect(r.ok).toBe(true);
  });

  it('accepts categories marked BOTH for either type', () => {
    expect(validateTransaction({ ...spent, category: 'Donations' }, ctx).ok).toBe(true);
    expect(validateTransaction({ ...spent, type: 'RECEIVED', category: 'Donations' }, ctx).ok).toBe(true);
  });

  it('rejects a category that belongs to the other type', () => {
    const r = validateTransaction({ ...spent, category: 'Salary' }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.category).toMatch(/from the list/);
  });

  it.each([
    ['', 'Enter an amount.'],
    ['0', 'greater than zero'],
    ['-5', 'greater than zero'],
    ['abc', 'greater than zero'],
    ['12.345', '2 decimal places'],
    ['99999999999', 'too large'],
  ])('rejects amount %j', (amount, message) => {
    const r = validateTransaction({ ...spent, amount }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.amount).toContain(message);
  });

  it('accepts amounts with ₹, commas and two decimals', () => {
    const r = validateTransaction({ ...spent, amount: '₹ 1,250.50' }, ctx);
    expect(r.ok && r.value.amount).toBe(1250.5);
  });

  it.each(['2026-02-30', '15/10/2026', '', '1999-12-31', '2028-01-01'])('rejects date %j', (date) => {
    const r = validateTransaction({ ...spent, date }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.date).toBeDefined();
  });

  it('requires type, category and payment method', () => {
    const r = validateTransaction({ ...spent, type: 'TRANSFER', category: '', paymentMethod: '' }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['category', 'paymentMethod', 'type']);
  });

  it('rejects unknown or inactive payment methods', () => {
    const r = validateTransaction({ ...spent, paymentMethod: 'Bitcoin' }, ctx);
    expect(r.ok).toBe(false);
    const inactive = validateTransaction(spent, { ...ctx, paymentMethods: [{ name: 'UPI', active: false }] });
    expect(inactive.ok).toBe(false);
  });

  it('limits merchant and notes length and strips control characters', () => {
    expect(validateTransaction({ ...spent, merchant: 'x'.repeat(101) }, ctx).ok).toBe(false);
    expect(validateTransaction({ ...spent, notes: 'x'.repeat(501) }, ctx).ok).toBe(false);
    const r = validateTransaction({ ...spent, notes: 'line1\nline2\u0000' }, ctx);
    expect(r.ok && r.value.notes).toBe('line1 line2');
  });

  it('merchant is optional', () => {
    expect(validateTransaction({ ...spent, merchant: '' }, ctx).ok).toBe(true);
  });
});

describe('categoriesFor', () => {
  it('filters by type and active flag', () => {
    const list = categoriesFor('RECEIVED', [
      { name: 'Salary', kind: 'RECEIVED', active: true },
      { name: 'Old', kind: 'RECEIVED', active: false },
      { name: 'Food', kind: 'SPENT', active: true },
      { name: 'Donations', kind: 'BOTH', active: true },
    ]);
    expect(list.map((c) => c.name)).toEqual(['Salary', 'Donations']);
  });
});

describe('cleanText', () => {
  it('collapses whitespace', () => expect(cleanText('  a   b  ')).toBe('a b'));
});

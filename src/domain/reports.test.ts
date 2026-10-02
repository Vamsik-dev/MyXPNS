import { fixtureTransactions } from '../test/fixtures';
import { categoryTotals, compareWithPreviousMonth, inMonth, monthSeries, monthlyTotals, totalsFor } from './reports';

const all = fixtureTransactions();

describe('monthly totals', () => {
  it('sums received, spent and net for a month', () => {
    expect(monthlyTotals(all, '2026-10')).toEqual({ received: 250000, spent: 3630.3, net: 246369.7, count: 6 });
    expect(monthlyTotals(all, '2026-09')).toEqual({ received: 250000, spent: 36850.5, net: 213149.5, count: 3 });
  });

  it('avoids floating point drift (0.1 + 0.2)', () => {
    const tiny = all.filter((t) => t.merchant === 'Corner Shop');
    expect(totalsFor(tiny).spent).toBe(0.3);
  });

  it('returns zeros for an empty month', () => {
    expect(monthlyTotals(all, '2025-01')).toEqual({ received: 0, spent: 0, net: 0, count: 0 });
  });
});

describe('category totals', () => {
  it('groups spending by category, largest first, with shares', () => {
    const rows = categoryTotals(inMonth(all, '2026-10'), 'SPENT');
    expect(rows.map((r) => [r.category, r.amount, r.count])).toEqual([
      ['Groceries', 2350.3, 3],
      ['Healthcare', 780, 1],
      ['Personal Care', 500, 1],
    ]);
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 10);
  });

  it('can total received money by category', () => {
    expect(categoryTotals(all, 'RECEIVED')).toEqual([{ category: 'Salary', amount: 500000, count: 2, share: 1 }]);
  });
});

describe('comparison and series', () => {
  it('compares with the previous month', () => {
    const c = compareWithPreviousMonth(all, '2026-10');
    expect(c.previous.spent).toBe(36850.5);
    expect(c.spentChange).toBeCloseTo((3630.3 - 36850.5) / 36850.5, 10);
  });

  it('has no percentage change when last month had no spending', () => {
    expect(compareWithPreviousMonth(all, '2026-09').spentChange).toBeUndefined();
  });

  it('builds an oldest-first month series across a year boundary', () => {
    const s = monthSeries(all, '2027-01', 6);
    expect(s.map((r) => r.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
    expect(s[2]!.spent).toBe(3630.3);
  });
});

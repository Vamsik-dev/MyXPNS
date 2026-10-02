import type { MonthKey } from './dates';
import { monthKeyOf, shiftMonth } from './dates';
import { fromMinor, toMinor } from './money';
import type { Transaction } from './types';

export interface Totals {
  received: number;
  spent: number;
  net: number;
  count: number;
}

export function totalsFor(transactions: Transaction[]): Totals {
  let received = 0;
  let spent = 0;
  for (const t of transactions) {
    if (t.type === 'RECEIVED') received += toMinor(t.amount);
    else spent += toMinor(t.amount);
  }
  return { received: fromMinor(received), spent: fromMinor(spent), net: fromMinor(received - spent), count: transactions.length };
}

export function inMonth(transactions: Transaction[], month: MonthKey): Transaction[] {
  return transactions.filter((t) => monthKeyOf(t.date) === month);
}

export function monthlyTotals(transactions: Transaction[], month: MonthKey): Totals {
  return totalsFor(inMonth(transactions, month));
}

export interface CategoryTotal {
  category: string;
  amount: number;
  count: number;
  /** Share of the total for this type, 0..1. */
  share: number;
}

/** Totals per category for one transaction type, largest first. */
export function categoryTotals(transactions: Transaction[], type: Transaction['type'] = 'SPENT'): CategoryTotal[] {
  const map = new Map<string, { minor: number; count: number }>();
  let all = 0;
  for (const t of transactions) {
    if (t.type !== type) continue;
    const m = toMinor(t.amount);
    all += m;
    const cur = map.get(t.category) ?? { minor: 0, count: 0 };
    cur.minor += m;
    cur.count += 1;
    map.set(t.category, cur);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, amount: fromMinor(v.minor), count: v.count, share: all ? v.minor / all : 0 }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

export interface MonthRow extends Totals {
  month: MonthKey;
}

/** The last `count` months ending at `endMonth`, oldest first. */
export function monthSeries(transactions: Transaction[], endMonth: MonthKey, count: number): MonthRow[] {
  const rows: MonthRow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const month = shiftMonth(endMonth, -i);
    rows.push({ month, ...monthlyTotals(transactions, month) });
  }
  return rows;
}

export interface Comparison {
  current: Totals;
  previous: Totals;
  /** Change in spending vs previous month; undefined if there was no spending last month. */
  spentChange?: number;
}

export function compareWithPreviousMonth(transactions: Transaction[], month: MonthKey): Comparison {
  const current = monthlyTotals(transactions, month);
  const previous = monthlyTotals(transactions, shiftMonth(month, -1));
  return {
    current,
    previous,
    spentChange: previous.spent > 0 ? (current.spent - previous.spent) / previous.spent : undefined,
  };
}

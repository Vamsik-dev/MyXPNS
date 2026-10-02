import { DEFAULT_CATEGORIES, DEFAULT_MERCHANT_RULES, DEFAULT_PAYMENT_METHODS, DEFAULT_SETTINGS } from '../../domain/defaults';
import { addDays, monthKeyOf, shiftMonth } from '../../domain/dates';
import type { LedgerData, Transaction } from '../../domain/types';

export const DEMO_USER = 'demo@myxpns.local';

type SeedRow = [dayOffsetInMonth: number, monthOffset: number, type: Transaction['type'], amount: number, category: string, merchant: string, payment: string, notes?: string];

/** Sample data. Dates are relative to "today" so the dashboard always has something to show. */
const ROWS: SeedRow[] = [
  [1, 0, 'RECEIVED', 250000, 'Salary', 'Salary', 'Bank Transfer'],
  [2, 0, 'SPENT', 2350, 'Groceries', 'DMart', 'UPI'],
  [2, 0, 'SPENT', 500, 'Personal Care', 'Barber', 'Cash'],
  [3, 0, 'SPENT', 780, 'Healthcare', 'Apollo Pharmacy', 'UPI'],
  [1, -1, 'RECEIVED', 250000, 'Salary', 'Salary', 'Bank Transfer'],
  [3, -1, 'SPENT', 35000, 'Rent', 'House Rent', 'Bank Transfer'],
  [6, -1, 'SPENT', 1850, 'Groceries', 'DMart', 'UPI'],
  [9, -1, 'SPENT', 640, 'Dining', 'Swiggy', 'UPI'],
  [14, -1, 'SPENT', 2400, 'Utilities', 'Electricity Bill', 'UPI', 'BESCOM'],
  [18, -1, 'SPENT', 3000, 'Fuel', 'Indian Oil', 'Credit Card'],
  [22, -1, 'SPENT', 5001, 'Donations', 'Temple', 'UPI'],
  [26, -1, 'SPENT', 649, 'Subscriptions', 'Netflix', 'Credit Card'],
];

export function demoLedger(today: string): LedgerData {
  const thisMonth = monthKeyOf(today);
  const transactions: Transaction[] = ROWS.map(([day, monthOffset, type, amount, category, merchant, payment, notes], i) => {
    let date = `${shiftMonth(thisMonth, monthOffset)}-${String(day).padStart(2, '0')}`;
    if (date > today) date = addDays(today, -i % 3); // keep sample data out of the future
    return {
      id: `TX-DEMO-${String(i + 1).padStart(3, '0')}`,
      date,
      type,
      amount,
      category,
      merchant,
      paymentMethod: payment,
      receiptUrl: '',
      notes: notes ?? '',
      createdAt: `${date}T09:${String(10 + i).padStart(2, '0')}:00.000Z`,
      createdBy: DEMO_USER,
    };
  });
  return {
    transactions,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    paymentMethods: DEFAULT_PAYMENT_METHODS.map((p) => ({ ...p })),
    merchantRules: DEFAULT_MERCHANT_RULES.map((r) => ({ ...r, aliases: [...r.aliases] })),
    settings: { ...DEFAULT_SETTINGS, ledgerName: 'Demo Ledger' },
    skippedRows: 0,
  };
}

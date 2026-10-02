import { DEFAULT_CATEGORIES, DEFAULT_MERCHANT_RULES, DEFAULT_PAYMENT_METHODS } from '../domain/defaults';
import type { Transaction } from '../domain/types';

export const TODAY = '2026-10-15';

let n = 0;
export function tx(partial: Partial<Transaction> & Pick<Transaction, 'date' | 'type' | 'amount' | 'category'>): Transaction {
  n += 1;
  return {
    id: `TX-FIX-${String(n).padStart(3, '0')}`,
    merchant: '',
    paymentMethod: 'UPI',
    receiptUrl: '',
    notes: '',
    createdAt: `${partial.date}T10:00:${String(n % 60).padStart(2, '0')}.000Z`,
    createdBy: 'me@example.com',
    ...partial,
  };
}

/** A fixed, small ledger: September + October 2026. */
export function fixtureTransactions(): Transaction[] {
  return [
    tx({ date: '2026-09-01', type: 'RECEIVED', amount: 250000, category: 'Salary', merchant: 'Salary', paymentMethod: 'Bank Transfer' }),
    tx({ date: '2026-09-05', type: 'SPENT', amount: 1850.5, category: 'Groceries', merchant: 'DMart' }),
    tx({ date: '2026-09-20', type: 'SPENT', amount: 35000, category: 'Rent', merchant: 'Landlord', paymentMethod: 'Bank Transfer' }),
    tx({ date: '2026-10-01', type: 'RECEIVED', amount: 250000, category: 'Salary', merchant: 'Salary', paymentMethod: 'Bank Transfer' }),
    tx({ date: '2026-10-03', type: 'SPENT', amount: 2350, category: 'Groceries', merchant: 'DMart' }),
    tx({ date: '2026-10-04', type: 'SPENT', amount: 500, category: 'Personal Care', merchant: 'Barber', paymentMethod: 'Cash' }),
    tx({ date: '2026-10-06', type: 'SPENT', amount: 780, category: 'Healthcare', merchant: 'Apollo Pharmacy' }),
    tx({ date: '2026-10-07', type: 'SPENT', amount: 0.1, category: 'Groceries', merchant: 'Corner Shop' }),
    tx({ date: '2026-10-07', type: 'SPENT', amount: 0.2, category: 'Groceries', merchant: 'Corner Shop' }),
  ];
}

export const categories = DEFAULT_CATEGORIES;
export const paymentMethods = DEFAULT_PAYMENT_METHODS;
export const merchantRules = DEFAULT_MERCHANT_RULES;

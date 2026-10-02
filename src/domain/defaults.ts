import type { Category, LedgerSettings, MerchantRule, PaymentMethod } from './types';

/**
 * Defaults written into a newly created workbook. After creation the workbook is the
 * source of truth: users edit the Categories / Payment_Methods / Merchant_Rules tabs.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Groceries', kind: 'SPENT', active: true },
  { name: 'Dining', kind: 'SPENT', active: true },
  { name: 'Transportation', kind: 'SPENT', active: true },
  { name: 'Fuel', kind: 'SPENT', active: true },
  { name: 'Personal Care', kind: 'SPENT', active: true },
  { name: 'Healthcare', kind: 'SPENT', active: true },
  { name: 'Education', kind: 'SPENT', active: true },
  { name: 'Utilities', kind: 'SPENT', active: true },
  { name: 'Rent', kind: 'BOTH', active: true },
  { name: 'Shopping', kind: 'SPENT', active: true },
  { name: 'Entertainment', kind: 'SPENT', active: true },
  { name: 'Travel', kind: 'SPENT', active: true },
  { name: 'Subscriptions', kind: 'SPENT', active: true },
  { name: 'Household', kind: 'SPENT', active: true },
  { name: 'Donations', kind: 'BOTH', active: true },
  { name: 'Salary', kind: 'RECEIVED', active: true },
  { name: 'Other Income', kind: 'RECEIVED', active: true },
  { name: 'Other Expense', kind: 'SPENT', active: true },
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  'UPI',
  'Cash',
  'Credit Card',
  'Debit Card',
  'Bank Transfer',
  'Other',
].map((name) => ({ name, active: true }));

/** A small starter set of common Indian merchants. Fully editable in the sheet. */
export const DEFAULT_MERCHANT_RULES: MerchantRule[] = [
  { merchant: 'DMart', aliases: ['Avenue Supermarts'], category: 'Groceries' },
  { merchant: 'BigBasket', aliases: ['bb now'], category: 'Groceries' },
  { merchant: 'Blinkit', aliases: [], category: 'Groceries' },
  { merchant: 'Zepto', aliases: [], category: 'Groceries' },
  { merchant: 'Swiggy', aliases: [], category: 'Dining' },
  { merchant: 'Zomato', aliases: [], category: 'Dining' },
  { merchant: 'Uber', aliases: [], category: 'Transportation' },
  { merchant: 'Ola', aliases: ['Ola Cabs'], category: 'Transportation' },
  { merchant: 'Rapido', aliases: [], category: 'Transportation' },
  { merchant: 'Indian Oil', aliases: ['IOCL'], category: 'Fuel' },
  { merchant: 'Bharat Petroleum', aliases: ['BPCL'], category: 'Fuel' },
  { merchant: 'HP Petrol', aliases: ['HPCL', 'Hindustan Petroleum'], category: 'Fuel' },
  { merchant: 'Apollo Pharmacy', aliases: ['Apollo Pharmacies'], category: 'Healthcare' },
  { merchant: 'Amazon', aliases: ['Amazon.in', 'AMZN'], category: 'Shopping' },
  { merchant: 'Flipkart', aliases: [], category: 'Shopping' },
  { merchant: 'Netflix', aliases: [], category: 'Subscriptions' },
];

export const DEFAULT_SETTINGS: LedgerSettings = {
  currency: 'INR',
  ledgerName: 'MyXPNS Ledger',
};

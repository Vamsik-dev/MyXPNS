import { addDays, isValidIsoDate, todayIso } from './dates';
import { parseAmount } from './money';
import type { Category, PaymentMethod, TransactionType } from './types';
import { TRANSACTION_TYPES } from './types';

/** What the entry form submits. Everything is untrusted until validated. */
export interface TransactionInput {
  type: string;
  amount: string | number;
  date: string;
  category: string;
  merchant?: string;
  paymentMethod: string;
  notes?: string;
}

export interface ValidTransactionInput {
  type: TransactionType;
  amount: number;
  date: string;
  category: string;
  merchant: string;
  paymentMethod: string;
  notes: string;
}

export type FieldErrors = Partial<Record<keyof TransactionInput, string>>;

export type ValidationResult =
  | { ok: true; value: ValidTransactionInput }
  | { ok: false; errors: FieldErrors };

export const LIMITS = {
  maxAmount: 10_000_000_000, // ₹1,000 crore — a sanity guard against typos, not a policy.
  merchantLength: 100,
  notesLength: 500,
  minDate: '2000-01-01',
  /** How far in the future a date may be (post-dated cheques, scheduled rent). */
  maxFutureDays: 366,
};

/** Removes control characters and collapses whitespace; keeps the text otherwise intact. */
export function cleanText(value: string | undefined): string {
  if (!value) return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function categoriesFor(type: TransactionType, categories: Category[]): Category[] {
  return categories.filter((c) => c.active && (c.kind === type || c.kind === 'BOTH'));
}

export function validateTransaction(
  input: TransactionInput,
  ctx: { categories: Category[]; paymentMethods: PaymentMethod[]; today?: string },
): ValidationResult {
  const errors: FieldErrors = {};
  const today = ctx.today ?? todayIso();

  const type = TRANSACTION_TYPES.find((t) => t === input.type);
  if (!type) errors.type = 'Choose Money Spent or Money Received.';

  const amount = parseAmount(input.amount);
  if (input.amount === '' || input.amount === undefined || input.amount === null) {
    errors.amount = 'Enter an amount.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than zero.';
  } else if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    errors.amount = 'Use at most 2 decimal places.';
  } else if (amount > LIMITS.maxAmount) {
    errors.amount = 'That amount looks too large.';
  }

  const date = cleanText(input.date);
  if (!isValidIsoDate(date)) {
    errors.date = 'Choose a valid date.';
  } else if (date < LIMITS.minDate || date > addDays(today, LIMITS.maxFutureDays)) {
    errors.date = 'That date is out of range.';
  }

  const category = cleanText(input.category);
  if (!category) {
    errors.category = 'Choose a category.';
  } else if (type && !categoriesFor(type, ctx.categories).some((c) => c.name === category)) {
    errors.category = 'Choose a category from the list.';
  }

  const paymentMethod = cleanText(input.paymentMethod);
  if (!paymentMethod) {
    errors.paymentMethod = 'Choose how it was paid.';
  } else if (!ctx.paymentMethods.some((p) => p.active && p.name === paymentMethod)) {
    errors.paymentMethod = 'Choose a payment method from the list.';
  }

  const merchant = cleanText(input.merchant);
  if (merchant.length > LIMITS.merchantLength) {
    errors.merchant = `Keep it under ${LIMITS.merchantLength} characters.`;
  }

  const notes = cleanText(input.notes);
  if (notes.length > LIMITS.notesLength) {
    errors.notes = `Keep notes under ${LIMITS.notesLength} characters.`;
  }

  if (Object.keys(errors).length > 0 || !type) return { ok: false, errors };
  return {
    ok: true,
    value: { type, amount: Math.round(amount * 100) / 100, date, category, merchant, paymentMethod, notes },
  };
}

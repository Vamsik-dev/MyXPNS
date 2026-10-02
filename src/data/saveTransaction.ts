import { newTransactionId } from '../domain/ids';
import type { MerchantIndex } from '../domain/merchants';
import { normalizeMerchant } from '../domain/merchants';
import { receiptFileName } from '../domain/receipts';
import type { Category, MerchantRule, PaymentMethod, Transaction } from '../domain/types';
import type { FieldErrors, TransactionInput } from '../domain/validation';
import { validateTransaction } from '../domain/validation';
import type { AppError } from './errors';
import { toAppError } from './errors';
import type { LedgerRepository, UploadedReceipt } from './repository';

export interface SaveRequest {
  repo: LedgerRepository;
  input: TransactionInput;
  ledger: { categories: Category[]; paymentMethods: PaymentMethod[]; history: Transaction[] };
  merchantIndex: MerchantIndex;
  createdBy: string;
  receipt?: { file: Blob; mimeType: string };
  rememberRule?: boolean;
  /** From a previous failed attempt: reuse its ID / uploaded receipt so a retry never duplicates. */
  previous?: { id: string; createdAt: string; uploadedReceipt?: UploadedReceipt; outcomeUnknown: boolean };
  now?: Date;
  today?: string;
}

export type SaveResult =
  | { status: 'invalid'; errors: FieldErrors }
  /** Receipt upload failed. Nothing was saved. The user can retry or save without the receipt. */
  | { status: 'receipt_failed'; error: AppError; attempt: NonNullable<SaveRequest['previous']> }
  /** Saving to the ledger failed. Any uploaded receipt is remembered for the retry. */
  | { status: 'save_failed'; error: AppError; attempt: NonNullable<SaveRequest['previous']> }
  | { status: 'saved'; transaction: Transaction; rules?: MerchantRule[]; ruleError?: AppError };

/**
 * The one place a transaction gets saved. Order matters:
 * validate → upload receipt (optional) → append row → remember merchant rule (optional).
 * Nothing is ever dropped silently: every failure is returned with enough state to retry.
 */
export async function saveTransaction(req: SaveRequest): Promise<SaveResult> {
  const valid = validateTransaction(req.input, { ...req.ledger, today: req.today });
  if (!valid.ok) return { status: 'invalid', errors: valid.errors };
  const v = valid.value;

  const now = req.now ?? new Date();
  const attempt = {
    id: req.previous?.id ?? newTransactionId(v.date),
    createdAt: req.previous?.createdAt ?? now.toISOString(),
    uploadedReceipt: req.previous?.uploadedReceipt,
    outcomeUnknown: false,
  };
  const merchant = normalizeMerchant(v.merchant, req.merchantIndex, req.ledger.history);

  if (req.receipt && !attempt.uploadedReceipt) {
    try {
      attempt.uploadedReceipt = await req.repo.uploadReceipt(req.receipt.file, {
        fileName: receiptFileName({ date: v.date, merchant, amount: v.amount, mimeType: req.receipt.mimeType }),
        date: v.date,
        mimeType: req.receipt.mimeType,
      });
    } catch (err) {
      return { status: 'receipt_failed', error: toAppError(err), attempt };
    }
  }

  const transaction: Transaction = {
    id: attempt.id,
    date: v.date,
    type: v.type,
    amount: v.amount,
    category: v.category,
    merchant,
    paymentMethod: v.paymentMethod,
    // Receipt is only linked when the user still wants it attached.
    receiptUrl: req.receipt ? (attempt.uploadedReceipt?.url ?? '') : '',
    notes: v.notes,
    createdAt: attempt.createdAt,
    createdBy: req.createdBy,
  };

  try {
    const alreadySaved = req.previous?.outcomeUnknown ? await req.repo.hasTransaction(attempt.id) : false;
    if (!alreadySaved) await req.repo.appendTransaction(transaction);
  } catch (err) {
    const error = toAppError(err);
    // A network failure during a write may still have reached Google; check on retry.
    return { status: 'save_failed', error, attempt: { ...attempt, outcomeUnknown: error.kind === 'network' || error.kind === 'server' || attempt.outcomeUnknown } };
  }

  if (req.rememberRule && merchant) {
    try {
      const rules = await req.repo.saveMerchantRule(merchant, v.category);
      return { status: 'saved', transaction, rules };
    } catch (err) {
      return { status: 'saved', transaction, ruleError: toAppError(err) };
    }
  }
  return { status: 'saved', transaction };
}

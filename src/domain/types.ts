/** Canonical MyXPNS data model. Mirrors the tabs of the user's finance workbook. */

export const TRANSACTION_TYPES = ['RECEIVED', 'SPENT'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export interface Transaction {
  id: string;
  /** Calendar date in YYYY-MM-DD (no time zone). */
  date: string;
  type: TransactionType;
  /** Positive amount in major currency units (e.g. rupees), max 2 decimals. */
  amount: number;
  category: string;
  /** Merchant for SPENT, person/source for RECEIVED. May be empty. */
  merchant: string;
  paymentMethod: string;
  receiptUrl: string;
  notes: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** Google account email of the person who recorded it. */
  createdBy: string;
}

/** Which transaction types a category applies to. */
export type CategoryKind = TransactionType | 'BOTH';

export interface Category {
  name: string;
  kind: CategoryKind;
  active: boolean;
}

export interface PaymentMethod {
  name: string;
  active: boolean;
}

export interface MerchantRule {
  /** Canonical display name, e.g. "DMart". */
  merchant: string;
  /** Other spellings that should map to this merchant, e.g. "Avenue Supermarts". */
  aliases: string[];
  /** Category to apply automatically. May be empty (normalization only). */
  category: string;
}

export interface LedgerSettings {
  currency: string;
  ledgerName: string;
}

/** Everything the app needs from the ledger, loaded in one go. */
export interface LedgerData {
  transactions: Transaction[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  merchantRules: MerchantRule[];
  settings: LedgerSettings;
  /** Rows in the Transactions tab that could not be read (e.g. edited by hand into an invalid state). */
  skippedRows: number;
}

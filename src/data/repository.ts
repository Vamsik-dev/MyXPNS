import type { LedgerData, MerchantRule, Transaction } from '../domain/types';

export interface UploadedReceipt {
  fileId: string;
  url: string;
}

/**
 * Everything the UI needs from storage. Two implementations: Google (Sheets + Drive)
 * and Demo (in-browser sample data).
 */
export interface LedgerRepository {
  readonly kind: 'google' | 'demo';
  /** Link to open the ledger in Google Sheets (absent in demo mode). */
  readonly spreadsheetUrl?: string;
  load(): Promise<LedgerData>;
  appendTransaction(tx: Transaction): Promise<void>;
  /** Used before retrying a save whose outcome was unknown, to avoid duplicate rows. */
  hasTransaction(id: string): Promise<boolean>;
  /** Creates or updates the rule for this merchant. Returns the full, updated rules list. */
  saveMerchantRule(merchant: string, category: string): Promise<MerchantRule[]>;
  uploadReceipt(file: Blob, meta: { fileName: string; date: string; mimeType: string }): Promise<UploadedReceipt>;
}

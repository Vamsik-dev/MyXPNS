import { RECEIPT_ROOT_FOLDER, receiptFolderPath } from '../../domain/receipts';
import type { LedgerData, MerchantRule, Transaction } from '../../domain/types';
import type { LedgerRepository, UploadedReceipt } from '../repository';
import { FolderResolver, findLedgers, tagLedger, uploadFile } from './drive';
import type { GoogleClient } from './http';
import type { LedgerInspection } from './sheets';
import {
  appendTransaction,
  createSpreadsheet,
  inspectSpreadsheet,
  prepareSpreadsheet,
  readLedger,
  transactionExists,
  upsertMerchantRule,
} from './sheets';

export const NEW_LEDGER_TITLE = 'MyXPNS Ledger';

/** The user's own ledger in Google Sheets, with receipts in their own Google Drive. */
export class GoogleLedgerRepository implements LedgerRepository {
  readonly kind = 'google' as const;
  readonly spreadsheetId: string;
  readonly spreadsheetUrl: string;
  private readonly client: GoogleClient;
  private readonly folders: FolderResolver;

  constructor(client: GoogleClient, spreadsheetId: string, folders = new FolderResolver(client)) {
    this.client = client;
    this.spreadsheetId = spreadsheetId;
    this.spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`;
    this.folders = folders;
  }

  load(): Promise<LedgerData> {
    return readLedger(this.client, this.spreadsheetId);
  }

  appendTransaction(tx: Transaction): Promise<void> {
    return appendTransaction(this.client, this.spreadsheetId, tx);
  }

  hasTransaction(id: string): Promise<boolean> {
    return transactionExists(this.client, this.spreadsheetId, id);
  }

  saveMerchantRule(merchant: string, category: string): Promise<MerchantRule[]> {
    return upsertMerchantRule(this.client, this.spreadsheetId, merchant, category);
  }

  async uploadReceipt(file: Blob, meta: { fileName: string; date: string; mimeType: string }): Promise<UploadedReceipt> {
    const folderId = await this.folders.resolve(receiptFolderPath(meta.date));
    const uploaded = await uploadFile(this.client, { name: meta.fileName, mimeType: meta.mimeType, folderId, data: file });
    return { fileId: uploaded.id, url: uploaded.webViewLink };
  }
}

/** "Create My Finance Sheet": new workbook inside MyXPNS/ in the user's Drive. */
export async function createLedger(client: GoogleClient): Promise<string> {
  const folders = new FolderResolver(client);
  const { id } = await createSpreadsheet(client, NEW_LEDGER_TITLE);
  const folderId = await folders.resolve([RECEIPT_ROOT_FOLDER]);
  await tagLedger(client, id, folderId);
  return id;
}

/** Checks a spreadsheet picked by the user. Nothing is written. */
export function checkExistingLedger(client: GoogleClient, id: string): Promise<LedgerInspection> {
  return inspectSpreadsheet(client, id);
}

/** Adds any missing MyXPNS tabs to a picked spreadsheet (after the user confirms). Never moves the file. */
export async function connectLedger(client: GoogleClient, id: string, inspection: LedgerInspection): Promise<void> {
  await prepareSpreadsheet(client, id, inspection);
  // The tag only helps MyXPNS find the sheet again on another device; failing to set it
  // (e.g. limited permissions on someone else's file) must not block connecting.
  await tagLedger(client, id).catch(() => undefined);
}

export { findLedgers };

import { todayIso } from '../../domain/dates';
import { upsertRule } from '../../domain/merchants';
import type { LedgerData, MerchantRule, Transaction } from '../../domain/types';
import type { KeyValueStore } from '../../lib/storage';
import { AppError } from '../errors';
import type { LedgerRepository, UploadedReceipt } from '../repository';
import { demoLedger } from './seed';

const STORAGE_KEY = 'myxpns:demo:v1';

export interface DemoOptions {
  store?: KeyValueStore;
  today?: string;
  /** For tests / manual QA: make receipt uploads or saves fail. */
  failReceiptUploads?: boolean;
  failSaves?: boolean;
  latencyMs?: number;
}

/**
 * Demo mode: sample data kept in this browser only. Never talks to Google.
 * Receipts are not stored anywhere — they get a placeholder link.
 */
export class DemoLedgerRepository implements LedgerRepository {
  readonly kind = 'demo' as const;
  readonly spreadsheetUrl = undefined;
  private data: LedgerData;
  private readonly opts: DemoOptions;

  constructor(opts: DemoOptions = {}) {
    this.opts = opts;
    this.data = this.restore() ?? demoLedger(opts.today ?? todayIso());
  }

  private restore(): LedgerData | undefined {
    const raw = this.opts.store?.get(STORAGE_KEY);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as LedgerData;
    } catch {
      return undefined;
    }
  }

  private persist() {
    this.opts.store?.set(STORAGE_KEY, JSON.stringify(this.data));
  }

  private async delay() {
    if (this.opts.latencyMs) await new Promise((r) => setTimeout(r, this.opts.latencyMs));
  }

  async load(): Promise<LedgerData> {
    await this.delay();
    return structuredClone(this.data);
  }

  async appendTransaction(tx: Transaction): Promise<void> {
    await this.delay();
    if (this.opts.failSaves) throw new AppError('network', 'Simulated failure.');
    this.data.transactions.push({ ...tx });
    this.persist();
  }

  async hasTransaction(id: string): Promise<boolean> {
    return this.data.transactions.some((t) => t.id === id);
  }

  async saveMerchantRule(merchant: string, category: string): Promise<MerchantRule[]> {
    await this.delay();
    this.data.merchantRules = upsertRule(this.data.merchantRules, merchant, category).rules;
    this.persist();
    return structuredClone(this.data.merchantRules);
  }

  async uploadReceipt(_file: Blob, meta: { fileName: string }): Promise<UploadedReceipt> {
    await this.delay();
    if (this.opts.failReceiptUploads) throw new AppError('network', 'Simulated upload failure.');
    return { fileId: `demo-${meta.fileName}`, url: `#demo-receipt/${encodeURIComponent(meta.fileName)}` };
  }

  static reset(store: KeyValueStore) {
    store.remove(STORAGE_KEY);
  }
}

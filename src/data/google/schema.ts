import { isValidIsoDate, isoDateToSerial, serialToIsoDate } from '../../domain/dates';
import { parseAmount } from '../../domain/money';
import type { Category, CategoryKind, LedgerSettings, MerchantRule, PaymentMethod, Transaction } from '../../domain/types';

/** The workbook layout. Column order is part of the contract — see docs/GOOGLE-SHEETS.md. */
export const TABS = {
  transactions: {
    title: 'Transactions',
    headers: ['Transaction ID', 'Date', 'Type', 'Amount', 'Category', 'Merchant / Person', 'Payment Method', 'Receipt URL', 'Notes', 'Created At', 'Created By'],
  },
  categories: { title: 'Categories', headers: ['Name', 'Type', 'Active'] },
  merchantRules: { title: 'Merchant_Rules', headers: ['Merchant', 'Aliases', 'Category'] },
  paymentMethods: { title: 'Payment_Methods', headers: ['Name', 'Active'] },
  settings: { title: 'Settings', headers: ['Key', 'Value'] },
} as const;

export type TabKey = keyof typeof TABS;
export const TAB_KEYS = Object.keys(TABS) as TabKey[];

/** Column letter of the last column for a tab, e.g. "K" for Transactions. */
export function lastColumn(tab: TabKey): string {
  return String.fromCharCode('A'.charCodeAt(0) + TABS[tab].headers.length - 1);
}

export function dataRange(tab: TabKey): string {
  return `${TABS[tab].title}!A2:${lastColumn(tab)}`;
}

export function headerRange(tab: TabKey): string {
  return `${TABS[tab].title}!A1:${lastColumn(tab)}1`;
}

type Cell = string | number | boolean | null | undefined;

function str(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).trim();
}

/** Accepts Sheets serial numbers, "YYYY-MM-DD" and Indian-style "DD/MM/YYYY". */
export function parseSheetDate(cell: Cell): string | undefined {
  if (typeof cell === 'number' && Number.isFinite(cell) && cell > 0) return serialToIsoDate(cell);
  const s = str(cell);
  if (isValidIsoDate(s)) return s;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) {
    const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
    if (isValidIsoDate(iso)) return iso;
  }
  return undefined;
}

export function parseBool(cell: Cell, fallback: boolean): boolean {
  if (typeof cell === 'boolean') return cell;
  const s = str(cell).toLowerCase();
  if (!s) return fallback;
  if (['false', 'no', 'n', '0', 'inactive'].includes(s)) return false;
  return true;
}

export function transactionToRow(tx: Transaction): (string | number)[] {
  return [
    tx.id,
    isoDateToSerial(tx.date),
    tx.type,
    tx.amount,
    tx.category,
    tx.merchant,
    tx.paymentMethod,
    tx.receiptUrl,
    tx.notes,
    tx.createdAt,
    tx.createdBy,
  ];
}

/** Returns undefined for rows that cannot be trusted (blank, missing ID/date/type/amount). */
export function rowToTransaction(row: Cell[]): Transaction | undefined {
  const id = str(row[0]);
  const date = parseSheetDate(row[1]);
  const typeText = str(row[2]).toUpperCase();
  const type = typeText === 'RECEIVED' || typeText === 'SPENT' ? typeText : undefined;
  const amount = typeof row[3] === 'number' ? row[3] : parseAmount(str(row[3]));
  if (!id || !date || !type || !Number.isFinite(amount) || amount <= 0) return undefined;
  return {
    id,
    date,
    type,
    amount: Math.round(amount * 100) / 100,
    category: str(row[4]) || 'Uncategorized',
    merchant: str(row[5]),
    paymentMethod: str(row[6]),
    receiptUrl: str(row[7]),
    notes: str(row[8]),
    createdAt: str(row[9]),
    createdBy: str(row[10]),
  };
}

export function isBlankRow(row: Cell[]): boolean {
  return row.every((c) => str(c) === '');
}

export function rowToCategory(row: Cell[]): Category | undefined {
  const name = str(row[0]);
  if (!name) return undefined;
  const k = str(row[1]).toUpperCase();
  const kind: CategoryKind = k === 'SPENT' || k === 'RECEIVED' ? k : 'BOTH';
  return { name, kind, active: parseBool(row[2], true) };
}

export function categoryToRow(c: Category): (string | boolean)[] {
  return [c.name, c.kind, c.active];
}

export function rowToPaymentMethod(row: Cell[]): PaymentMethod | undefined {
  const name = str(row[0]);
  return name ? { name, active: parseBool(row[1], true) } : undefined;
}

export function paymentMethodToRow(p: PaymentMethod): (string | boolean)[] {
  return [p.name, p.active];
}

export function rowToMerchantRule(row: Cell[]): MerchantRule | undefined {
  const merchant = str(row[0]);
  if (!merchant) return undefined;
  const aliases = str(row[1])
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter(Boolean);
  return { merchant, aliases, category: str(row[2]) };
}

export function merchantRuleToRow(r: MerchantRule): string[] {
  return [r.merchant, r.aliases.join(', '), r.category];
}

export function rowsToSettings(rows: Cell[][], defaults: LedgerSettings): LedgerSettings {
  const map = new Map(rows.map((r) => [str(r[0]), str(r[1])]));
  return {
    currency: /^[A-Z]{3}$/.test(map.get('Currency') ?? '') ? map.get('Currency')! : defaults.currency,
    ledgerName: map.get('Ledger Name') || defaults.ledgerName,
  };
}

export function settingsToRows(s: LedgerSettings, createdAt: string): string[][] {
  return [
    ['Schema Version', '1'],
    ['Ledger Name', s.ledgerName],
    ['Currency', s.currency],
    ['Created At', createdAt],
  ];
}

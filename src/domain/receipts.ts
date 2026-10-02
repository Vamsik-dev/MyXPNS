import { MONTH_NAMES } from './dates';

export const RECEIPT_ROOT_FOLDER = 'MyXPNS';
export const RECEIPTS_FOLDER = 'Receipts';
export const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];

/** ["MyXPNS", "Receipts", "2026", "10-October"] */
export function receiptFolderPath(date: string): string[] {
  const [y, m] = date.split('-');
  const monthIdx = Number(m) - 1;
  return [RECEIPT_ROOT_FOLDER, RECEIPTS_FOLDER, y!, `${m}-${MONTH_NAMES[monthIdx]}`];
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

/** "2026-10-03_DMart_1250.jpg" — safe for every OS, no personal notes in the name. */
export function receiptFileName(args: { date: string; merchant: string; amount: number; mimeType: string }): string {
  const merchant =
    args.merchant
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '')
      .slice(0, 40) || 'Receipt';
  const amount = Number.isInteger(args.amount) ? String(args.amount) : args.amount.toFixed(2);
  const ext = EXT_BY_TYPE[args.mimeType] ?? 'bin';
  return `${args.date}_${merchant}_${amount}.${ext}`;
}

export function checkReceiptFile(file: { type: string; size: number }): string | undefined {
  if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) return 'Receipts must be a photo (JPEG, PNG, WebP, HEIC) or a PDF.';
  if (file.size > MAX_RECEIPT_BYTES) return 'That file is too large (max 15 MB).';
  if (file.size === 0) return 'That file is empty.';
  return undefined;
}

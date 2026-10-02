import { useApp } from '../app/AppState';
import { shortDateLabel } from '../domain/dates';
import { formatMoney } from '../domain/money';
import type { Transaction } from '../domain/types';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';

export function TransactionDetail({ tx, currency, onClose }: { tx: Transaction; currency: string; onClose: () => void }) {
  const { repo } = useApp();
  const rows: [string, string][] = [
    ['Date', `${shortDateLabel(tx.date)} (${tx.date})`],
    ['Category', tx.category],
    [tx.type === 'SPENT' ? 'Merchant' : 'Received from', tx.merchant || '—'],
    ['Payment', tx.paymentMethod || '—'],
    ['Notes', tx.notes || '—'],
    ['Recorded by', tx.createdBy || '—'],
    ['ID', tx.id],
  ];
  const receiptIsLink = /^https:\/\//.test(tx.receiptUrl);
  return (
    <Sheet title={tx.type === 'SPENT' ? 'Money Spent' : 'Money Received'} onClose={onClose}>
      <p className={`num mb-4 text-[34px] font-bold ${tx.type === 'RECEIVED' ? 'text-positive' : ''}`}>{formatMoney(tx.amount, currency)}</p>
      <dl className="divide-y divide-line rounded-2xl bg-surface">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-4 px-4 py-3">
            <dt className="w-28 shrink-0 text-muted">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-col gap-2">
        {tx.receiptUrl &&
          (receiptIsLink ? (
            <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface font-semibold text-accent">
              <Icon name="receipt" className="size-5" /> View receipt in Google Drive
            </a>
          ) : (
            <p className="text-center text-muted">Receipt attached (demo — not stored).</p>
          ))}
        {repo?.spreadsheetUrl && (
          <a href={repo.spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl font-semibold text-accent">
            Edit or delete in Google Sheets <Icon name="external" className="size-4" />
          </a>
        )}
      </div>
    </Sheet>
  );
}

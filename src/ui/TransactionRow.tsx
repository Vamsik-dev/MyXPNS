import type { Transaction } from '../domain/types';
import { Amount } from './Amount';
import { Icon } from './Icon';

export function TransactionRow({ tx, currency, onClick }: { tx: Transaction; currency: string; onClick?: () => void }) {
  const title = tx.merchant || tx.category;
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px]">{title}</div>
          <div className="truncate text-[14px] text-muted">
            {tx.merchant ? tx.category : ''}
            {tx.merchant ? ' · ' : ''}
            {tx.paymentMethod}
          </div>
        </div>
        {tx.receiptUrl && <Icon name="receipt" className="size-4 text-muted" />}
        <Amount value={tx.amount} currency={currency} type={tx.type} className="text-[17px] font-medium" />
      </button>
    </li>
  );
}

export function TransactionList({ items, currency, onSelect }: { items: Transaction[]; currency: string; onSelect?: (tx: Transaction) => void }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
      {items.map((tx) => (
        <TransactionRow key={tx.id} tx={tx} currency={currency} onClick={onSelect ? () => onSelect(tx) : undefined} />
      ))}
    </ul>
  );
}

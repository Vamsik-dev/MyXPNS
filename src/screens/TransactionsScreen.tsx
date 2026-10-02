import { useMemo, useState } from 'react';
import { useApp } from '../app/AppState';
import { monthKeyOf, shortDateLabel, todayIso } from '../domain/dates';
import { latestFirst } from '../domain/merchants';
import { inMonth, totalsFor } from '../domain/reports';
import type { Transaction, TransactionType } from '../domain/types';
import { Amount } from '../ui/Amount';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { MonthPicker } from '../ui/MonthPicker';
import { TransactionList } from '../ui/TransactionRow';

type Filter = 'ALL' | TransactionType;

export function TransactionsScreen({ onSelect }: { onSelect: (tx: Transaction) => void }) {
  const ledger = useApp().data!;
  const currency = ledger.settings.currency;
  const thisMonth = monthKeyOf(todayIso());
  const [month, setMonth] = useState(thisMonth);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return latestFirst(inMonth(ledger.transactions, month)).filter(
      (t) =>
        (filter === 'ALL' || t.type === filter) &&
        (!q || [t.merchant, t.category, t.notes, t.paymentMethod].some((f) => f.toLowerCase().includes(q))),
    );
  }, [ledger.transactions, month, filter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of items) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()];
  }, [items]);
  const totals = totalsFor(items);

  return (
    <div>
      <header className="pb-4 pt-6">
        <h1 className="text-[34px] font-bold tracking-tight">Transactions</h1>
      </header>
      <MonthPicker month={month} onChange={setMonth} max={thisMonth} />
      <div className="mt-3 grid grid-cols-3 rounded-2xl bg-surface-2 p-1" role="tablist" aria-label="Filter">
        {(['ALL', 'SPENT', 'RECEIVED'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-10 rounded-xl text-[15px] font-medium ${filter === f ? 'bg-surface shadow-sm' : 'text-muted'}`}
          >
            {f === 'ALL' ? 'All' : f === 'SPENT' ? 'Spent' : 'Received'}
          </button>
        ))}
      </div>
      <label className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-4">
        <Icon name="search" className="size-5 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search merchant, category, notes"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
          aria-label="Search transactions"
        />
      </label>

      {groups.length === 0 ? (
        <Card className="mt-6 text-center text-muted">No transactions{query ? ' match your search' : ' this month'}.</Card>
      ) : (
        <>
          <p className="num mt-4 px-1 text-[14px] text-muted">
            {items.length} transaction{items.length === 1 ? '' : 's'}
            {filter !== 'RECEIVED' && (
              <>
                {' '}· Spent <Amount value={totals.spent} currency={currency} />
              </>
            )}
            {filter !== 'SPENT' && (
              <>
                {' '}· Received <Amount value={totals.received} currency={currency} />
              </>
            )}
          </p>
          {groups.map(([date, txs]) => (
            <section key={date}>
              <h2 className="mb-2 mt-5 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">{shortDateLabel(date)}</h2>
              <TransactionList items={txs} currency={currency} onSelect={onSelect} />
            </section>
          ))}
        </>
      )}
    </div>
  );
}

import { useApp } from '../app/AppState';
import { hrefFor } from '../app/router';
import { monthKeyOf, monthLabel, todayIso } from '../domain/dates';
import { latestFirst } from '../domain/merchants';
import { formatMoney } from '../domain/money';
import { monthlyTotals } from '../domain/reports';
import type { Transaction } from '../domain/types';
import { Card, SectionTitle } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { TransactionList } from '../ui/TransactionRow';

export function HomeScreen({ onSelect }: { onSelect: (tx: Transaction) => void }) {
  const { data } = useApp();
  const ledger = data!;
  const currency = ledger.settings.currency;
  const month = monthKeyOf(todayIso());
  const totals = monthlyTotals(ledger.transactions, month);
  const recent = latestFirst(ledger.transactions).slice(0, 6);

  return (
    <div>
      <header className="pb-4 pt-6">
        <h1 className="text-[34px] font-bold tracking-tight">MyXPNS</h1>
      </header>

      <Card>
        <p className="text-[15px] font-medium text-muted">This Month · {monthLabel(month)}</p>
        <dl className="mt-3 space-y-2">
          <Row label="Money Received" value={formatMoney(totals.received, currency)} tone="positive" />
          <Row label="Money Spent" value={formatMoney(totals.spent, currency)} />
          <div className="my-1 border-t border-line" />
          <Row label="Net" value={formatMoney(totals.net, currency, { signed: true })} strong tone={totals.net < 0 ? 'negative' : undefined} />
        </dl>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <a href={hrefFor({ name: 'add', type: 'RECEIVED' })} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-3xl bg-surface text-[16px] font-semibold text-positive active:bg-surface-2">
          <Icon name="plus" className="size-7" strokeWidth={2.2} />
          Money Received
        </a>
        <a href={hrefFor({ name: 'add', type: 'SPENT' })} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-3xl bg-accent text-[16px] font-semibold text-accent-ink active:opacity-80">
          <Icon name="minus" className="size-7" strokeWidth={2.2} />
          Money Spent
        </a>
      </div>

      <SectionTitle
        action={
          recent.length > 0 && (
            <a href={hrefFor({ name: 'transactions' })} className="text-[15px] text-accent">
              See all
            </a>
          )
        }
      >
        Recent Transactions
      </SectionTitle>
      {recent.length ? (
        <TransactionList items={recent} currency={currency} onSelect={onSelect} />
      ) : (
        <Card className="text-center text-muted">No transactions yet. Tap “Money Spent” to add your first one.</Card>
      )}
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'positive' | 'negative' }) {
  const color = tone === 'positive' ? 'text-positive' : tone === 'negative' ? 'text-negative' : '';
  return (
    <div className="flex items-baseline justify-between">
      <dt className={`text-[17px] ${strong ? 'font-semibold' : ''}`}>{label}</dt>
      <dd className={`num text-[22px] ${strong ? 'font-bold' : 'font-semibold'} ${color}`}>{value}</dd>
    </div>
  );
}

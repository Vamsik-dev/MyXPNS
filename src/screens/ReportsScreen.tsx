import { useState } from 'react';
import { useApp } from '../app/AppState';
import { MONTH_NAMES, monthKeyOf, monthLabel, todayIso } from '../domain/dates';
import { formatMoney } from '../domain/money';
import { categoryTotals, compareWithPreviousMonth, inMonth, monthSeries } from '../domain/reports';
import { Card, SectionTitle } from '../ui/Card';
import { MonthPicker } from '../ui/MonthPicker';

export function ReportsScreen() {
  const ledger = useApp().data!;
  const currency = ledger.settings.currency;
  const thisMonth = monthKeyOf(todayIso());
  const [month, setMonth] = useState(thisMonth);

  const monthTx = inMonth(ledger.transactions, month);
  const { current, previous, spentChange } = compareWithPreviousMonth(ledger.transactions, month);
  const spentByCategory = categoryTotals(monthTx, 'SPENT');
  const receivedByCategory = categoryTotals(monthTx, 'RECEIVED');
  const series = monthSeries(ledger.transactions, month, 6);
  const seriesMax = Math.max(1, ...series.map((r) => Math.max(r.received, r.spent)));

  return (
    <div>
      <header className="pb-4 pt-6">
        <h1 className="text-[34px] font-bold tracking-tight">Reports</h1>
      </header>
      <MonthPicker month={month} onChange={setMonth} max={thisMonth} />

      <SectionTitle>Income &amp; Expense</SectionTitle>
      <Card>
        <dl className="space-y-2">
          <Line label="Money Received" value={formatMoney(current.received, currency)} sub={`Last month ${formatMoney(previous.received, currency)}`} positive />
          <Line
            label="Money Spent"
            value={formatMoney(current.spent, currency)}
            sub={
              spentChange === undefined
                ? `Last month ${formatMoney(previous.spent, currency)}`
                : `${spentChange >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(spentChange * 100))}% vs last month (${formatMoney(previous.spent, currency)})`
            }
          />
          <div className="border-t border-line pt-2">
            <Line label="Net" value={formatMoney(current.net, currency, { signed: true })} strong />
          </div>
        </dl>
      </Card>

      <SectionTitle>Spending by Category</SectionTitle>
      <CategoryBars rows={spentByCategory} currency={currency} empty={`No spending in ${monthLabel(month)}.`} />

      {receivedByCategory.length > 0 && (
        <>
          <SectionTitle>Received by Category</SectionTitle>
          <CategoryBars rows={receivedByCategory} currency={currency} empty="" positive />
        </>
      )}

      <SectionTitle>Last 6 Months</SectionTitle>
      <Card>
        <ul className="space-y-4">
          {series.map((r) => {
            const m = Number(r.month.slice(5)) - 1;
            return (
              <li key={r.month}>
                <div className="flex items-baseline justify-between text-[15px]">
                  <span className="font-medium">
                    {MONTH_NAMES[m]!.slice(0, 3)} {r.month.slice(0, 4)}
                  </span>
                  <span className={`num ${r.net < 0 ? 'text-negative' : 'text-muted'}`}>Net {formatMoney(r.net, currency, { signed: true })}</span>
                </div>
                <Bar value={r.received} max={seriesMax} className="bg-positive" label={`Received ${formatMoney(r.received, currency)}`} />
                <Bar value={r.spent} max={seriesMax} className="bg-accent" label={`Spent ${formatMoney(r.spent, currency)}`} />
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex gap-4 text-[13px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-positive" /> Received
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-accent" /> Spent
          </span>
        </p>
      </Card>
    </div>
  );
}

function Line({ label, value, sub, strong, positive }: { label: string; value: string; sub?: string; strong?: boolean; positive?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <dt className={strong ? 'font-semibold' : ''}>{label}</dt>
        <dd className={`num text-[20px] ${strong ? 'font-bold' : 'font-semibold'} ${positive ? 'text-positive' : ''}`}>{value}</dd>
      </div>
      {sub && <p className="num text-right text-[13px] text-muted">{sub}</p>}
    </div>
  );
}

function CategoryBars({ rows, currency, empty, positive }: { rows: ReturnType<typeof categoryTotals>; currency: string; empty: string; positive?: boolean }) {
  if (!rows.length) return <Card className="text-center text-muted">{empty}</Card>;
  const max = rows[0]!.amount;
  return (
    <Card>
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.category}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[16px]">{r.category}</span>
              <span className="num shrink-0 text-[16px] font-medium">
                {formatMoney(r.amount, currency)} <span className="text-[13px] text-muted">{Math.round(r.share * 100)}%</span>
              </span>
            </div>
            <Bar value={r.amount} max={max} className={positive ? 'bg-positive' : 'bg-accent'} label="" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Bar({ value, max, className, label }: { value: number; max: number; className: string; label: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div className="mt-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role={label ? 'img' : undefined} aria-label={label || undefined}>
        <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

import type { MonthKey } from '../domain/dates';
import { monthLabel, shiftMonth } from '../domain/dates';
import { Icon } from './Icon';

export function MonthPicker({ month, onChange, max }: { month: MonthKey; onChange: (m: MonthKey) => void; max: MonthKey }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface p-1">
      <button type="button" aria-label="Previous month" onClick={() => onChange(shiftMonth(month, -1))} className="grid size-11 place-items-center rounded-xl active:bg-surface-2">
        <Icon name="chevronLeft" className="size-5" />
      </button>
      <span className="text-[17px] font-semibold">{monthLabel(month)}</span>
      <button
        type="button"
        aria-label="Next month"
        disabled={month >= max}
        onClick={() => onChange(shiftMonth(month, 1))}
        className="grid size-11 place-items-center rounded-xl active:bg-surface-2 disabled:opacity-30"
      >
        <Icon name="chevronRight" className="size-5" />
      </button>
    </div>
  );
}

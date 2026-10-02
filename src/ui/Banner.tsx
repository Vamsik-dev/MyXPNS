import type { ReactNode } from 'react';

export function Banner({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'error' | 'info' }) {
  const cls =
    tone === 'error' ? 'bg-surface text-negative border border-line' : tone === 'info' ? 'bg-surface text-ink border border-line' : 'bg-warn-bg text-warn-ink';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 text-[15px] ${cls}`}>
      {children}
    </div>
  );
}

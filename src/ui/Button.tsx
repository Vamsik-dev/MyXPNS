import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'plain' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink active:opacity-80',
  secondary: 'bg-surface text-ink border border-line active:bg-surface-2',
  plain: 'bg-transparent text-accent active:opacity-60',
  danger: 'bg-surface text-negative border border-line active:bg-surface-2',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[17px] font-semibold transition disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  );
}

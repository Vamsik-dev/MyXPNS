import { formatMoney } from '../domain/money';
import type { TransactionType } from '../domain/types';

export function Amount({ value, currency, type, className = '' }: { value: number; currency: string; type?: TransactionType; className?: string }) {
  const color = type === 'RECEIVED' ? 'text-positive' : '';
  const prefix = type === 'RECEIVED' ? '+' : '';
  return <span className={`num ${color} ${className}`}>{prefix}{formatMoney(value, currency)}</span>;
}

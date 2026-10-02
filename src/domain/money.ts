/** Money helpers. Sums are done in integer minor units (paise) to avoid float drift. */

export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency = 'INR', opts: { signed?: boolean } = {}): string {
  let f = formatters.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 });
    } catch {
      f = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
    }
    formatters.set(currency, f);
  }
  const text = f.format(Math.abs(amount));
  if (amount < 0) return `−${text}`;
  if (opts.signed && amount > 0) return `+${text}`;
  return text;
}

/**
 * Parses what a person types into the amount field: "1,250", "₹ 1250.50", "1250".
 * Returns NaN when it is not a plain positive-looking decimal number.
 */
export function parseAmount(input: string | number): number {
  if (typeof input === 'number') return input;
  const cleaned = input.replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  return Number(cleaned);
}

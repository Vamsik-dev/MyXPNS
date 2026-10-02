/** Transaction IDs look like TX-20261003-K7Q2M9: sortable by day, unique enough for a family ledger. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function newTransactionId(date: string, random: (n: number) => Uint8Array = randomBytes): string {
  const bytes = random(6);
  let suffix = '';
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  return `TX-${date.replace(/-/g, '')}-${suffix}`;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

import { AppError } from '../data/errors';
import type { GoogleClient } from '../data/google/http';
import { findLedgers } from '../data/google/repository';
import type { KeyValueStore } from '../lib/storage';
import { prefs } from '../lib/storage';

/**
 * Which spreadsheet should this Google account use?
 * 1. The one remembered on this device for this account.
 * 2. Otherwise the most recently modified ledger MyXPNS created/connected for this account.
 * 3. Otherwise none — the user creates or connects one.
 */
export async function chooseLedgerId(client: GoogleClient, store: KeyValueStore, email: string): Promise<string | undefined> {
  const remembered = prefs.ledgerId(store, email);
  if (remembered) return remembered;
  const found = await findLedgers(client);
  const id = found[0]?.id;
  if (id) prefs.setLedgerId(store, email, id);
  return id;
}

/** Whether a load error means the remembered ledger is gone / no longer accessible. */
export function isLedgerUnavailable(err: unknown): boolean {
  return err instanceof AppError && (err.kind === 'not_found' || err.kind === 'forbidden');
}

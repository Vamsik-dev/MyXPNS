/**
 * Small, failure-tolerant wrappers around localStorage. Only non-financial preferences are
 * stored here (spreadsheet ID, last used payment method, demo data). Never tokens.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const browserStore: KeyValueStore = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable (private mode) — preference just isn't remembered */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

const PREFIX = 'myxpns:';

/** Ledger choice is remembered per Google account, so a shared phone never mixes accounts. */
export const prefs = {
  ledgerId: (store: KeyValueStore, email: string) => store.get(`${PREFIX}ledger:${email.toLowerCase()}`),
  setLedgerId: (store: KeyValueStore, email: string, id: string) => store.set(`${PREFIX}ledger:${email.toLowerCase()}`, id),
  clearLedgerId: (store: KeyValueStore, email: string) => store.remove(`${PREFIX}ledger:${email.toLowerCase()}`),
  lastEmail: (store: KeyValueStore) => store.get(`${PREFIX}lastEmail`),
  setLastEmail: (store: KeyValueStore, email: string) => store.set(`${PREFIX}lastEmail`, email),
  clearLastEmail: (store: KeyValueStore) => store.remove(`${PREFIX}lastEmail`),
  lastPayment: (store: KeyValueStore, type: string) => store.get(`${PREFIX}lastPayment:${type}`),
  setLastPayment: (store: KeyValueStore, type: string, method: string) => store.set(`${PREFIX}lastPayment:${type}`, method),
};

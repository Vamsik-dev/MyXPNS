import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { revokeGoogleToken, signInWithGoogle } from '../auth/googleIdentity';
import type { GoogleSession } from '../auth/googleIdentity';
import { pickSpreadsheet } from '../auth/picker';
import { config } from '../config';
import { DemoLedgerRepository } from '../data/demo/repository';
import type { DemoOptions } from '../data/demo/repository';
import { DEMO_USER } from '../data/demo/seed';
import { AppError, toAppError } from '../data/errors';
import { createGoogleClient } from '../data/google/http';
import type { GoogleClient } from '../data/google/http';
import { GoogleLedgerRepository, checkExistingLedger, connectLedger, createLedger } from '../data/google/repository';
import type { LedgerInspection } from '../data/google/sheets';
import type { LedgerRepository } from '../data/repository';
import type { LedgerData, MerchantRule, Transaction } from '../domain/types';
import { browserStore, prefs } from '../lib/storage';
import { chooseLedgerId, isLedgerUnavailable } from './ledgerSelection';

export type Phase = 'signed-out' | 'busy' | 'needs-ledger' | 'ready' | 'error';

export interface PendingConnection {
  id: string;
  name: string;
  inspection: LedgerInspection;
}

interface AppState {
  phase: Phase;
  mode: 'demo' | 'google' | null;
  email: string | null;
  repo: LedgerRepository | null;
  data: LedgerData | null;
  error: AppError | null;
  busyLabel: string;
  /** True when the Google token has expired; the UI asks the user to continue with Google. */
  authExpired: boolean;
  pendingConnection: PendingConnection | null;
}

interface AppActions {
  startDemo(): Promise<void>;
  signIn(): Promise<void>;
  reauthenticate(): Promise<void>;
  signOut(): void;
  createNewLedger(): Promise<void>;
  pickExistingLedger(): Promise<void>;
  confirmConnection(): Promise<void>;
  cancelConnection(): void;
  switchLedger(): void;
  reload(): Promise<void>;
  /** Merge a successful save into local state without re-reading the sheet. */
  applySaved(tx: Transaction, rules?: MerchantRule[]): void;
  resetDemo(): Promise<void>;
  clearError(): void;
}

const Ctx = createContext<(AppState & AppActions) | null>(null);

const INITIAL: AppState = {
  phase: 'signed-out',
  mode: null,
  email: null,
  repo: null,
  data: null,
  error: null,
  busyLabel: '',
  authExpired: false,
  pendingConnection: null,
};

export function AppStateProvider({
  children,
  store = browserStore,
  demoOptions,
}: {
  children: ReactNode;
  store?: typeof browserStore;
  /** Tests only: e.g. simulate failing receipt uploads in demo mode. */
  demoOptions?: Omit<DemoOptions, 'store'>;
}) {
  const [state, setState] = useState<AppState>(INITIAL);
  const session = useRef<GoogleSession | null>(null);
  const clientRef = useRef<GoogleClient | null>(null);

  const patch = useCallback((p: Partial<AppState>) => setState((s) => ({ ...s, ...p })), []);

  const getClient = useCallback((): GoogleClient => {
    if (!clientRef.current) {
      clientRef.current = createGoogleClient({
        getToken: () => {
          const s = session.current;
          // Treat tokens within a minute of expiry as expired to avoid mid-request failures.
          return s && s.expiresAt - 60_000 > Date.now() ? s.accessToken : undefined;
        },
        onUnauthorized: () => setState((st) => (st.mode === 'google' ? { ...st, authExpired: true } : st)),
      });
    }
    return clientRef.current;
  }, []);

  const loadInto = useCallback(
    async (repo: LedgerRepository, mode: 'demo' | 'google', email: string) => {
      patch({ phase: 'busy', busyLabel: 'Loading your ledger…', error: null, repo, mode, email });
      try {
        const data = await repo.load();
        patch({ phase: 'ready', data, repo, mode, email, busyLabel: '' });
      } catch (err) {
        if (mode === 'google' && isLedgerUnavailable(err)) {
          prefs.clearLedgerId(store, email);
          patch({ phase: 'needs-ledger', repo: null, data: null, error: toAppError(err), busyLabel: '' });
          return;
        }
        patch({ phase: 'error', error: toAppError(err), busyLabel: '' });
      }
    },
    [patch, store],
  );

  const openLedger = useCallback(
    (id: string, email: string) => {
      prefs.setLedgerId(store, email, id);
      return loadInto(new GoogleLedgerRepository(getClient(), id), 'google', email);
    },
    [getClient, loadInto, store],
  );

  const startDemo = useCallback(async () => {
    await loadInto(new DemoLedgerRepository({ ...demoOptions, store }), 'demo', DEMO_USER);
  }, [demoOptions, loadInto, store]);

  const signIn = useCallback(async () => {
    if (!config.googleClientId) {
      patch({ error: new AppError('bad_request', 'Google sign-in is not configured for this deployment. Try the demo instead.') });
      return;
    }
    patch({ phase: 'busy', busyLabel: 'Signing in…', error: null });
    try {
      const s = await signInWithGoogle(config.googleClientId, prefs.lastEmail(store) ?? undefined);
      session.current = s;
      prefs.setLastEmail(store, s.email);
      patch({ mode: 'google', email: s.email, authExpired: false, busyLabel: 'Finding your ledger…' });
      const id = await chooseLedgerId(getClient(), store, s.email);
      if (id) await openLedger(id, s.email);
      else patch({ phase: 'needs-ledger', busyLabel: '' });
    } catch (err) {
      session.current = null;
      patch({ phase: 'signed-out', mode: null, email: null, error: toAppError(err), busyLabel: '' });
    }
  }, [getClient, openLedger, patch, store]);

  const reauthenticate = useCallback(async () => {
    if (!config.googleClientId) return;
    try {
      const s = await signInWithGoogle(config.googleClientId, state.email ?? undefined);
      if (state.email && s.email.toLowerCase() !== state.email.toLowerCase()) {
        // A different account signed in: never show the previous account's data.
        revokeGoogleToken(s.accessToken);
        session.current = null;
        setState({ ...INITIAL, error: new AppError('bad_request', `Please continue as ${state.email}, or sign out first.`) });
        return;
      }
      session.current = s;
      patch({ authExpired: false, error: null });
    } catch (err) {
      patch({ error: toAppError(err) });
    }
  }, [patch, state.email]);

  const signOut = useCallback(() => {
    if (session.current) revokeGoogleToken(session.current.accessToken);
    session.current = null;
    clientRef.current = null;
    // Drop every piece of in-memory ledger data.
    setState(INITIAL);
  }, []);

  const createNewLedger = useCallback(async () => {
    const email = state.email;
    if (!email) return;
    patch({ phase: 'busy', busyLabel: 'Creating your finance sheet…', error: null });
    try {
      const id = await createLedger(getClient());
      await openLedger(id, email);
    } catch (err) {
      patch({ phase: 'needs-ledger', error: toAppError(err), busyLabel: '' });
    }
  }, [getClient, openLedger, patch, state.email]);

  const pickExistingLedger = useCallback(async () => {
    const token = session.current?.accessToken;
    if (!token) {
      patch({ authExpired: true });
      return;
    }
    patch({ error: null });
    try {
      const picked = await pickSpreadsheet({ token, apiKey: config.googleApiKey, appId: config.googleAppId });
      if (!picked) return;
      patch({ phase: 'busy', busyLabel: 'Checking the sheet…' });
      const inspection = await checkExistingLedger(getClient(), picked.id);
      const needsChanges = inspection.missing.length > 0 || inspection.empty.length > 0;
      if (inspection.problems.length) {
        patch({ phase: 'needs-ledger', busyLabel: '', error: new AppError('invalid_ledger', `“${picked.name}” can’t be used: ${inspection.problems.join(' ')}`) });
      } else if (needsChanges) {
        patch({ phase: 'needs-ledger', busyLabel: '', pendingConnection: { ...picked, inspection } });
      } else {
        await connectLedger(getClient(), picked.id, inspection);
        await openLedger(picked.id, state.email!);
      }
    } catch (err) {
      patch({ phase: 'needs-ledger', busyLabel: '', error: toAppError(err) });
    }
  }, [getClient, openLedger, patch, state.email]);

  const confirmConnection = useCallback(async () => {
    const pending = state.pendingConnection;
    if (!pending || !state.email) return;
    patch({ phase: 'busy', busyLabel: 'Preparing the sheet…', pendingConnection: null });
    try {
      await connectLedger(getClient(), pending.id, pending.inspection);
      await openLedger(pending.id, state.email);
    } catch (err) {
      patch({ phase: 'needs-ledger', busyLabel: '', error: toAppError(err) });
    }
  }, [getClient, openLedger, patch, state.email, state.pendingConnection]);

  const cancelConnection = useCallback(() => patch({ pendingConnection: null }), [patch]);

  const switchLedger = useCallback(() => {
    if (state.email) prefs.clearLedgerId(store, state.email);
    patch({ phase: 'needs-ledger', repo: null, data: null, error: null });
  }, [patch, state.email, store]);

  const reload = useCallback(async () => {
    if (!state.repo || !state.mode || !state.email) return;
    try {
      const data = await state.repo.load();
      patch({ data, error: null, phase: 'ready' });
    } catch (err) {
      patch({ error: toAppError(err) });
    }
  }, [patch, state.email, state.mode, state.repo]);

  const applySaved = useCallback((tx: Transaction, rules?: MerchantRule[]) => {
    setState((s) =>
      s.data ? { ...s, data: { ...s.data, transactions: [...s.data.transactions, tx], merchantRules: rules ?? s.data.merchantRules } } : s,
    );
  }, []);

  const resetDemo = useCallback(async () => {
    DemoLedgerRepository.reset(store);
    await startDemo();
  }, [startDemo, store]);

  const clearError = useCallback(() => patch({ error: null }), [patch]);

  const value = useMemo(
    () => ({
      ...state,
      startDemo,
      signIn,
      reauthenticate,
      signOut,
      createNewLedger,
      pickExistingLedger,
      confirmConnection,
      cancelConnection,
      switchLedger,
      reload,
      applySaved,
      resetDemo,
      clearError,
    }),
    [state, startDemo, signIn, reauthenticate, signOut, createNewLedger, pickExistingLedger, confirmConnection, cancelConnection, switchLedger, reload, applySaved, resetDemo, clearError],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}

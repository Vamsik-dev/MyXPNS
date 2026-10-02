import { useState } from 'react';
import { config } from '../config';
import { userMessage } from '../data/errors';
import type { Transaction } from '../domain/types';
import { useOnline } from '../lib/useOnline';
import { EntryScreen } from '../screens/EntryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LedgerSetupScreen } from '../screens/LedgerSetupScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TransactionDetail } from '../screens/TransactionDetail';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { TabBar } from '../ui/TabBar';
import { useApp } from './AppState';
import { useRoute } from './router';

export function App() {
  const app = useApp();

  if (app.phase === 'signed-out') return <WelcomeScreen />;
  if (app.phase === 'busy' && !app.data) return <FullScreenMessage text={app.busyLabel || 'Loading…'} spinner />;
  if (app.phase === 'needs-ledger') return <LedgerSetupScreen />;
  if (app.phase === 'error' || !app.data) {
    return (
      <FullScreenMessage text={userMessage(app.error)}>
        <Button onClick={() => void app.reload()}>Try again</Button>
        <Button variant="secondary" onClick={app.signOut}>
          Sign out
        </Button>
      </FullScreenMessage>
    );
  }
  return <Shell />;
}

function Shell() {
  const app = useApp();
  const route = useRoute();
  const online = useOnline();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const data = app.data!;

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <div className="safe-top space-y-2 px-4 pt-3 empty:hidden">
        {app.mode === 'demo' && (
          <Banner>
            <strong>Demo mode</strong> — sample data stored only in this browser. Nothing is sent to Google.
          </Banner>
        )}
        {config.appEnv !== 'production' && app.mode === 'google' && <Banner tone="info">Environment: {config.appEnv}</Banner>}
        {!online && <Banner>You’re offline. You can look around, but saving needs a connection.</Banner>}
        {app.authExpired && (
          <Banner>
            <div className="flex items-center justify-between gap-3">
              <span>Your Google session expired.</span>
              <Button className="min-h-10 px-4 text-[15px]" onClick={() => void app.reauthenticate()}>
                Continue
              </Button>
            </div>
          </Banner>
        )}
        {app.error && app.phase === 'ready' && (
          <Banner tone="error">
            <div className="flex items-center justify-between gap-3">
              <span>{userMessage(app.error)}</span>
              <button type="button" className="font-semibold text-accent" onClick={app.clearError}>
                OK
              </button>
            </div>
          </Banner>
        )}
        {data.skippedRows > 0 && (
          <Banner tone="info">
            {data.skippedRows} row{data.skippedRows === 1 ? '' : 's'} in your sheet couldn’t be read (missing ID, date, type or amount) and {data.skippedRows === 1 ? 'is' : 'are'} not
            included in totals.
          </Banner>
        )}
      </div>

      <main className="flex-1 px-4 pb-28">
        {route.name === 'add' ? (
          <EntryScreen key={route.type} type={route.type} />
        ) : route.name === 'transactions' ? (
          <TransactionsScreen onSelect={setSelected} />
        ) : route.name === 'reports' ? (
          <ReportsScreen />
        ) : route.name === 'settings' ? (
          <SettingsScreen />
        ) : (
          <HomeScreen onSelect={setSelected} />
        )}
      </main>

      {route.name !== 'add' && <TabBar active={route.name} />}
      {selected && <TransactionDetail tx={selected} currency={data.settings.currency} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FullScreenMessage({ text, spinner, children }: { text: string; spinner?: boolean; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-8 text-center">
      {spinner && <div className="size-8 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />}
      <p className="text-[17px] text-muted" role="status">
        {text}
      </p>
      {children && <div className="flex w-full flex-col gap-3">{children}</div>}
    </div>
  );
}

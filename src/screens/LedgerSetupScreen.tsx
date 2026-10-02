import { useApp } from '../app/AppState';
import { pickerConfigured } from '../config';
import { userMessage } from '../data/errors';
import { TABS } from '../data/google/schema';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

export function LedgerSetupScreen() {
  const app = useApp();
  const busy = app.phase === 'busy';
  const pending = app.pendingConnection;
  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-lg flex-col px-6 pb-10">
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-[15px] text-muted">Signed in as {app.email}</p>
        <h1 className="mt-2 text-[30px] font-bold tracking-tight">Set up your finance sheet</h1>
        <p className="mt-3 text-[17px] text-muted">
          MyXPNS keeps your transactions in a Google Sheet that you own. Receipts go into a <strong>MyXPNS</strong> folder in your Google Drive.
        </p>
      </div>
      {app.error && (
        <div className="mb-4">
          <Banner tone="error">{userMessage(app.error)}</Banner>
        </div>
      )}
      {busy && (
        <p className="mb-4 text-center text-muted" role="status">
          {app.busyLabel}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button disabled={busy} onClick={() => void app.createNewLedger()}>
          Create My Finance Sheet
        </Button>
        {pickerConfigured() && (
          <Button variant="secondary" disabled={busy} onClick={() => void app.pickExistingLedger()}>
            Connect an existing sheet
          </Button>
        )}
        <p className="px-2 text-center text-[13px] text-muted">
          Someone shared their MyXPNS sheet with you? Use “Connect an existing sheet” and pick it.
        </p>
        <Button variant="plain" disabled={busy} onClick={app.signOut}>
          Sign out
        </Button>
      </div>
      {pending && (
        <Sheet title="Prepare this sheet?" onClose={app.cancelConnection}>
          <p className="text-[16px]">
            MyXPNS will add the following to <strong>{pending.name}</strong>. Nothing existing will be changed or deleted.
          </p>
          <ul className="my-4 list-disc pl-6 text-[16px] text-muted">
            {pending.inspection.missing.map((k) => (
              <li key={k}>New tab “{TABS[k].title}”</li>
            ))}
            {pending.inspection.empty.map((k) => (
              <li key={k}>Column headers in the empty “{TABS[k].title}” tab</li>
            ))}
          </ul>
          <div className="flex flex-col gap-3">
            <Button onClick={() => void app.confirmConnection()}>Add tabs and connect</Button>
            <Button variant="secondary" onClick={app.cancelConnection}>
              Cancel
            </Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

import type { ReactNode } from 'react';
import { useApp } from '../app/AppState';
import { pickerConfigured } from '../config';
import { Button } from '../ui/Button';
import { Card, SectionTitle } from '../ui/Card';
import { Icon } from '../ui/Icon';

export function SettingsScreen() {
  const app = useApp();
  const ledger = app.data!;
  const isDemo = app.mode === 'demo';
  const sheetUrl = app.repo?.spreadsheetUrl;

  return (
    <div>
      <header className="pb-2 pt-6">
        <h1 className="text-[34px] font-bold tracking-tight">Settings</h1>
      </header>

      <SectionTitle>Account</SectionTitle>
      <Card>
        <p className="text-[13px] text-muted">{isDemo ? 'Demo mode' : 'Signed in with Google'}</p>
        <p className="mt-1 break-all text-[17px]">{isDemo ? 'Sample data in this browser only' : app.email}</p>
        <Button variant="secondary" className="mt-4 w-full" onClick={app.signOut}>
          {isDemo ? 'Leave demo' : 'Sign out'}
        </Button>
      </Card>

      <SectionTitle>Finance Sheet</SectionTitle>
      <Card>
        <p className="text-[17px] font-medium">{ledger.settings.ledgerName}</p>
        {sheetUrl ? (
          <>
            <p className="mt-1 text-[15px] text-muted">Your transactions live in this Google Sheet. Edit or delete entries directly there.</p>
            <ExternalLink href={sheetUrl}>Open in Google Sheets</ExternalLink>
            <ExternalLink href="https://drive.google.com/drive/search?q=MyXPNS%20type:folder">Open receipts folder in Google Drive</ExternalLink>
            <Button variant="secondary" className="mt-3 w-full" onClick={() => void app.reload()}>
              Refresh from sheet
            </Button>
            <Button variant="plain" className="mt-1 w-full" onClick={app.switchLedger}>
              {pickerConfigured() ? 'Use a different sheet' : 'Create a new sheet'}
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-[15px] text-muted">In demo mode nothing is stored in Google.</p>
            <Button variant="secondary" className="mt-3 w-full" onClick={() => void app.resetDemo()}>
              Reset demo data
            </Button>
          </>
        )}
      </Card>

      <SectionTitle>Sharing with family</SectionTitle>
      <Card>
        <ol className="list-decimal space-y-2 pl-5 text-[15px]">
          <li>Open your finance sheet in Google Sheets.</li>
          <li>
            Tap <strong>Share</strong> and add the other person’s Google account as an <strong>Editor</strong>.
          </li>
          <li>
            They sign in to MyXPNS with their Google account and choose <strong>Connect an existing sheet</strong>.
          </li>
        </ol>
        <p className="mt-3 text-[13px] text-muted">
          Receipts are saved in the Drive of whoever adds them. To let others open them, share your MyXPNS/Receipts folder in Google Drive too.
        </p>
        {sheetUrl && <ExternalLink href={sheetUrl}>Open sheet to share</ExternalLink>}
      </Card>

      <SectionTitle>Lists</SectionTitle>
      <Card className="space-y-1 p-2">
        <ListDetails title="Categories" count={ledger.categories.filter((c) => c.active).length}>
          {ledger.categories.map((c) => (
            <li key={c.name} className={`flex justify-between ${c.active ? '' : 'text-muted line-through'}`}>
              <span>{c.name}</span>
              <span className="text-[13px] text-muted">{c.kind === 'BOTH' ? 'Both' : c.kind === 'SPENT' ? 'Spent' : 'Received'}</span>
            </li>
          ))}
        </ListDetails>
        <ListDetails title="Payment methods" count={ledger.paymentMethods.filter((p) => p.active).length}>
          {ledger.paymentMethods.map((p) => (
            <li key={p.name} className={p.active ? '' : 'text-muted line-through'}>
              {p.name}
            </li>
          ))}
        </ListDetails>
        <ListDetails title="Merchant rules" count={ledger.merchantRules.length}>
          {ledger.merchantRules.map((r) => (
            <li key={r.merchant} className="flex justify-between gap-3">
              <span className="truncate">
                {r.merchant}
                {r.aliases.length > 0 && <span className="text-[13px] text-muted"> · {r.aliases.join(', ')}</span>}
              </span>
              <span className="shrink-0 text-muted">{r.category || '—'}</span>
            </li>
          ))}
        </ListDetails>
        <p className="px-3 pb-2 text-[13px] text-muted">
          {sheetUrl
            ? 'To add, rename or hide items, edit the Categories, Payment_Methods and Merchant_Rules tabs in your sheet, then tap “Refresh from sheet”.'
            : 'With a real Google Sheet you edit these lists in the sheet’s tabs.'}
        </p>
      </Card>

      <SectionTitle>Install on your phone</SectionTitle>
      <Card>
        <p className="text-[15px]">
          <strong>iPhone:</strong> open in Safari → Share → <em>Add to Home Screen</em>.
        </p>
        <p className="mt-2 text-[15px]">
          <strong>Android:</strong> open in Chrome → ⋮ menu → <em>Install app</em> or <em>Add to Home screen</em>.
        </p>
      </Card>

      <SectionTitle>How MyXPNS works</SectionTitle>
      <Card className="space-y-2 text-[15px]">
        <p>Your Google account is your identity — MyXPNS has no separate accounts or passwords.</p>
        <p>Google Sheets and Google Drive own your data and control who can see it. MyXPNS has no server or database of its own.</p>
        <p>MyXPNS can only open files it created for you or that you picked. It never reads email or SMS, and never sends your finances to AI or analytics services.</p>
      </Card>
      <p className="mt-6 text-center text-[12px] text-muted">MyXPNS v1</p>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-11 items-center gap-2 text-[16px] font-medium text-accent">
      {children} <Icon name="external" className="size-4" />
    </a>
  );
}

function ListDetails({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <details className="group rounded-2xl">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-[17px]">
        {title}
        <span className="flex items-center gap-1 text-muted">
          {count} <Icon name="chevronRight" className="size-4 transition group-open:rotate-90" />
        </span>
      </summary>
      <ul className="space-y-2 px-3 pb-3 text-[15px]">{children}</ul>
    </details>
  );
}

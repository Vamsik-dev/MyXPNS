import { useApp } from '../app/AppState';
import { googleConfigured } from '../config';
import { userMessage } from '../data/errors';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';

export function WelcomeScreen() {
  const app = useApp();
  const canSignIn = googleConfigured();
  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-lg flex-col px-6 pb-10">
      <div className="flex flex-1 flex-col justify-center">
        <img src="/icons/icon.svg" alt="" className="mb-6 size-20 rounded-[22px]" />
        <h1 className="text-[34px] font-bold tracking-tight">MyXPNS</h1>
        <p className="mt-3 text-[19px] leading-snug text-muted">Track money spent and received in seconds. Your records stay in your own Google Sheet and Drive.</p>
        <ul className="mt-8 space-y-3 text-[16px] text-muted">
          <li>• Your Google account is your login — no new password.</li>
          <li>• MyXPNS only sees the sheet and receipts it creates for you.</li>
          <li>• No ads, no tracking, no AI reading your finances.</li>
        </ul>
      </div>
      {app.error && (
        <div className="mb-4">
          <Banner tone="error">{userMessage(app.error)}</Banner>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {canSignIn ? (
          <Button onClick={() => void app.signIn()}>Continue with Google</Button>
        ) : (
          <Banner tone="info">Google sign-in isn’t configured for this build. See docs/SETUP.md. You can still try the demo.</Banner>
        )}
        <Button variant="secondary" onClick={() => void app.startDemo()}>
          Try the demo
        </Button>
      </div>
    </div>
  );
}

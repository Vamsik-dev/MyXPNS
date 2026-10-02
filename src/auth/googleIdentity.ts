import { AppError } from '../data/errors';
import { loadScript } from './loadScript';
import { DRIVE_FILE_SCOPE, OAUTH_SCOPES } from './scopes';

/**
 * Google Identity Services (GIS) token model, entirely in the browser.
 * The access token lives in memory only (never localStorage/cookies) and expires after ~1 hour;
 * the user then taps "Continue with Google" again. There is no refresh token and no server.
 */

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    include_granted_scopes?: boolean;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleAccountsOAuth2 } };
  }
}

export interface GoogleSession {
  accessToken: string;
  expiresAt: number;
  email: string;
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

export async function signInWithGoogle(clientId: string, loginHint?: string): Promise<GoogleSession> {
  await loadScript(GIS_SRC).catch(() => {
    throw new AppError('network', 'Could not reach Google sign-in.');
  });
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new AppError('network', 'Google sign-in is unavailable.');

  const response = await new Promise<TokenResponse>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: OAUTH_SCOPES.join(' '),
      callback: resolve,
      error_callback: (e) =>
        reject(new AppError('unauthorized', e.type === 'popup_closed' ? 'Sign-in was cancelled.' : 'Sign-in could not be completed.')),
    });
    // Empty prompt: Google only shows consent the first time (or when scopes change).
    client.requestAccessToken({ prompt: '', login_hint: loginHint });
  });

  if (response.error || !response.access_token) {
    throw new AppError('unauthorized', response.error === 'access_denied' ? 'Access was not granted.' : 'Sign-in could not be completed.');
  }
  if (!oauth2.hasGrantedAllScopes(response, DRIVE_FILE_SCOPE)) {
    oauth2.revoke(response.access_token);
    throw new AppError(
      'forbidden',
      'MyXPNS needs permission to create and open its own files in your Google Drive (your ledger sheet and receipts). Please sign in again and allow it.',
    );
  }

  const email = await fetchEmail(response.access_token);
  return {
    accessToken: response.access_token,
    expiresAt: Date.now() + Number(response.expires_in ?? 3600) * 1000,
    email,
  };
}

async function fetchEmail(token: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(USERINFO, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new AppError('network', 'Could not reach Google.');
  }
  if (!res.ok) throw new AppError('unauthorized', 'Could not read your Google account.');
  const info = (await res.json()) as { email?: string; email_verified?: boolean };
  if (!info.email || info.email_verified === false) throw new AppError('forbidden', 'Your Google account email is not verified.');
  return info.email;
}

export function revokeGoogleToken(token: string): void {
  try {
    window.google?.accounts?.oauth2?.revoke(token);
  } catch {
    /* best effort */
  }
}

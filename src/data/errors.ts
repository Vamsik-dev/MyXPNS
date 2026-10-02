export type AppErrorKind =
  | 'unauthorized' // token missing/expired/revoked → sign in again
  | 'forbidden' // signed in, but no access to this file / scope not granted
  | 'not_found'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'invalid_ledger'
  | 'bad_request';

/** An error safe to show to the user. Never carries tokens or financial data. */
export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status?: number;
  constructor(kind: AppErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.status = status;
  }
  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'rate_limited' || this.kind === 'server';
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  return new AppError('server', 'Something went wrong. Please try again.');
}

export function userMessage(err: unknown): string {
  const e = toAppError(err);
  switch (e.kind) {
    case 'unauthorized':
      return 'Your Google session has expired. Please continue with Google again.';
    case 'forbidden':
      return 'MyXPNS doesn’t have access to this Google file. Open it with “Connect an existing sheet” or ask the owner to share it with you.';
    case 'not_found':
      return 'The Google file could not be found. It may have been deleted or moved to trash.';
    case 'rate_limited':
      return 'Google is busy right now. Please wait a moment and try again.';
    case 'network':
      return 'No connection. Check your internet and try again — nothing was lost.';
    case 'invalid_ledger':
    case 'bad_request':
      return e.message;
    default:
      return 'Google returned an error. Please try again.';
  }
}

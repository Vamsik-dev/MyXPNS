/**
 * The complete list of OAuth scopes MyXPNS requests. See docs/OAUTH.md.
 *
 * - openid + email: identify the signed-in Google account ("Created By", per-account preferences).
 * - drive.file: create/open ONLY files that MyXPNS created or that the user explicitly picked.
 *   This covers the Sheets API for the ledger and the Drive API for receipts. MyXPNS cannot
 *   see any other file in the user's Drive.
 *
 * Deliberately NOT requested: spreadsheets (all sheets), drive (all files), gmail.*, contacts, etc.
 */
export const OAUTH_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'] as const;

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

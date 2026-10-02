# Privacy model

MyXPNS is built so that **no one but you, and the people you share with through Google, can see your finances**. That includes the people who build or host MyXPNS.

## Where data lives

| Data | Location | Who controls access |
|---|---|---|
| Transactions, categories, rules, settings | A Google Sheet in **your** Google Drive | You, via Google Sheets sharing |
| Receipts | `MyXPNS/Receipts/…` in **your** Google Drive | You, via Google Drive sharing |
| Spreadsheet ID, last payment method, last signed-in email | This browser's localStorage | You (clear site data to remove) |
| Google access token | Browser memory only, about 1 hour | Discarded on reload, sign-out or expiry |
| Demo data | This browser's localStorage | Sample data only; never sent anywhere |

MyXPNS has **no server and no database**. The hosting provider (Firebase Hosting by default) serves static files. Like any web server it sees request metadata such as IP address and user agent, but never transaction data, receipts or tokens. Those go directly from your browser to Google.

## Commitments (enforced in code)

- **No AI or LLM.** Categorization is deterministic (`src/domain/merchants.ts`).
- **No analytics, tracking, advertising or data brokers.** There are no third-party scripts except Google's own sign-in (`accounts.google.com`) and Picker (`apis.google.com`). The Content-Security-Policy in `firebase.json` blocks other script origins.
- **Least-privilege OAuth.** Only `openid`, `email` and `drive.file`. No Gmail, no SMS, no full Drive or Sheets access. See [OAUTH.md](OAUTH.md).
- **No logging of financial data.** The app does not log amounts, merchants, notes, receipt contents or tokens. ESLint forbids `console.log`. Error messages shown to users never contain financial data.
- **The offline cache holds only the app shell.** The service worker (`public/sw.js`) caches same-origin static files only and never intercepts Google API requests.
- **No formula injection.** Rows are written with `valueInputOption=RAW`, so text such as `=IMPORTXML(...)` is stored as text, never executed as a formula.
- **Input validation.** Every transaction is validated before writing (`src/domain/validation.ts`): type, amount (positive, at most 2 decimals, sanity cap), real calendar date in a sane range, category and payment method from the lists, length limits, control characters stripped. Receipts must be an image or PDF up to 15 MB.
- **Account separation.** Preferences are keyed by Google account email. If a different account signs in while re-authenticating, MyXPNS discards the session instead of showing the previous account's data. Sign-out clears all in-memory data.
- **No secrets in the repository.** Client ID, API key and project number come from untracked `.env.*` files. `.gitignore` excludes them.

## Unauthorized access

Each user's data can only be reached with a Google access token for an account that Google already lets read that file. MyXPNS holds no credentials of its own that could reach anyone's data. A request without a valid token is refused before it is sent (`src/data/google/http.ts`), and 401/403 responses become clear "sign in again" or "no access" messages. Tests: `src/data/google/http.test.ts`, `src/app/ledgerSelection.test.ts`.

## Deleting your data

Delete the **MyXPNS Ledger** spreadsheet and the **MyXPNS** folder from Google Drive. Then remove MyXPNS's access at <https://myaccount.google.com/permissions>. Clear this site's data in your browser to remove local preferences.

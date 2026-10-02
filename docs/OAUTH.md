# OAuth scopes

MyXPNS requests exactly three scopes. The list lives in `src/auth/scopes.ts`.

| Scope | Sensitivity | Why |
|---|---|---|
| `openid` | Non-sensitive | Standard sign-in |
| `email` | Non-sensitive | Learn which Google account is signed in. Used for the **Created By** column and to keep per-account preferences apart on a shared device |
| `https://www.googleapis.com/auth/drive.file` | Non-sensitive (*recommended* by Google) | Create the ledger spreadsheet and receipt files, and open **only** files that MyXPNS created or that the user explicitly picked in the Google Picker |

`drive.file` is enough for both APIs MyXPNS uses:

- **Sheets API**: read and append to the ledger spreadsheet (created by the app or picked by the user).
- **Drive API**: create the `MyXPNS/Receipts/YYYY/MM-Month` folders, upload receipts, and find the app's own ledger on a new device.

## Deliberately not requested

| Scope | Why not |
|---|---|
| `spreadsheets` / `spreadsheets.readonly` | Would allow reading **every** spreadsheet in the user's Drive (restricted/sensitive) |
| `drive` / `drive.readonly` | Would allow reading every file (restricted) |
| `gmail.*` | MyXPNS does not read email |
| SMS / contacts / calendar / profile | Not needed |

Because only non-sensitive scopes are used, the OAuth consent screen does not need Google's restricted-scope security assessment. Publishing the app for anyone outside your test users still requires the standard brand verification. See [SETUP.md](SETUP.md).

## Token handling

- The browser obtains a short-lived **access token** (about 1 hour) from Google Identity Services. There is **no refresh token** and no server.
- The token lives **in memory only**: never in localStorage, cookies, the service worker cache or logs. Closing or reloading the app discards it.
- It is sent only in the `Authorization` header to `*.googleapis.com` (`src/data/google/http.ts`).
- When it expires, Google returns 401. MyXPNS shows **"Your Google session expired — Continue"** and keeps the form you were filling in.
- **Sign out** revokes the token with Google and clears all in-memory ledger data.
- If the user unticks Drive access on Google's consent screen (granular consent), MyXPNS revokes the token and explains why the permission is needed.

## Consequences of `drive.file` (by design)

- MyXPNS cannot see the rest of your Drive, including other spreadsheets.
- To use a spreadsheet MyXPNS did not create (for example one someone shared with you), you must pick it once via **Connect an existing sheet**. That grants access to that one file.
- A receipt uploaded by person A is in A's Drive. Person B can open it only if A shares the `MyXPNS/Receipts` folder, or the file, with B.

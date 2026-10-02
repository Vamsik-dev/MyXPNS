# MyXPNS

A deliberately simple, privacy-conscious **personal / family expense and receipt tracker** for your phone.

- Sign in with **Google**, with no new account or password.
- Record **Money Spent** or **Money Received** in about 10 seconds.
- Attach a **receipt photo** if you want one.
- Everything is stored in **your own Google Sheet** (the ledger), with receipts in **your own Google Drive**.
- Merchants are categorized by simple **deterministic rules** (DMart → Groceries) that learn from your choices. No AI.
- See this month's totals, recent transactions and spending by category.
- Share the sheet with family using Google's normal **Share** button.

MyXPNS has **no server and no database**. It is a static web app (installable as a PWA) that talks directly from your browser to Google Sheets and Google Drive.

## How it works

```
Google Sign-In ─▶ MyXPNS (PWA in your browser) ─▶ Google Sheets = ledger
                                               └▶ Google Drive  = receipts
```

| Question | Answer |
|---|---|
| Who am I? | Your Google account |
| Where is my data? | A spreadsheet `MyXPNS Ledger` and a folder `MyXPNS/Receipts` in your Drive |
| Who can see it? | Whoever you share it with in Google. MyXPNS's authors and hosting cannot |
| What can MyXPNS access? | Only files it created or that you picked (`drive.file` scope) |

More: [Architecture](docs/ARCHITECTURE.md) · [OAuth scopes](docs/OAUTH.md) · [Privacy](docs/PRIVACY.md) · [Sheet layout](docs/GOOGLE-SHEETS.md) · [Receipts](docs/GOOGLE-DRIVE.md) · [Testing](docs/TESTING.md)

## Architecture in one paragraph

Vite + React 19 + TypeScript + Tailwind CSS 4, built to static files. The only runtime dependencies are `react` and `react-dom`. Pure business logic (validation, merchant rules, reports) lives in `src/domain/` and is unit-tested. The UI talks to a `LedgerRepository` with two implementations: **Google** (Sheets API v4 + Drive API v3 via `fetch`, using a Google Identity Services access token held in memory) and **Demo** (seeded sample data in the browser). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Local development

```bash
npm install
npm run dev        # http://localhost:5173 → "Try the demo"
npm run check      # lint + typecheck + tests + build
```

Demo mode works with no configuration. It is clearly marked and never contacts Google.

## Google OAuth setup

Short version (full steps in [docs/SETUP.md](docs/SETUP.md)):

1. In Google Cloud, enable the **Google Sheets API**, **Google Drive API** and (optionally) the **Google Picker API**.
2. Configure the OAuth consent screen with the scopes `openid`, `email` and `https://www.googleapis.com/auth/drive.file`, and add your family as test users.
3. Create a **Web application** OAuth client. Authorized JavaScript origin: `http://localhost:5173` (plus your deployed origins).
4. Optionally create an API key restricted to your origins and to the Picker API.
5. `cp .env.example .env.local` and fill in `VITE_GOOGLE_CLIENT_ID` (plus `VITE_GOOGLE_API_KEY` and `VITE_GOOGLE_APP_ID` for the Picker).

### Google APIs required

| API | Used for |
|---|---|
| Google Identity Services (sign-in) | Access token + email |
| Google Sheets API v4 | Create, read and append to the ledger |
| Google Drive API v3 | Receipt folders and uploads; filing and finding the ledger |
| Google Picker API (optional) | "Connect an existing sheet" |

## Deployment

Static hosting on **Firebase Hosting**, with separate staging and production sites and security headers in `firebase.json`:

```bash
npm run deploy:staging
npm run deploy:production
```

Exact checklist: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Install on your phone (PWA)

- **iPhone**: open the site in **Safari** → Share → **Add to Home Screen**.
- **Android**: open the site in **Chrome** → ⋮ → **Install app** / **Add to Home screen**.

The installed app opens full-screen and its shell works offline. Saving needs a connection: the app tells you when you are offline and never loses what you typed.

## Known limitations (V1)

- **Editing or deleting transactions happens in Google Sheets** (the app links straight to it). The app itself only adds transactions.
- **Category, payment-method and merchant-rule lists are edited in the sheet's tabs.** The app shows them, and adds merchant rules when you tick "Always categorize".
- **Google sessions last about 1 hour.** After that you tap **Continue** once, because there is no server to hold refresh tokens (by design).
- **No offline queue.** Transactions cannot be saved while offline. The form keeps its contents until you retry.
- **Receipts belong to whoever uploaded them.** Sharing the sheet does not share receipts; share the `MyXPNS/Receipts` folder too.
- **A shared sheet must be connected once** by each person via the Google Picker. That requires the API key / project number configuration; without it only "Create My Finance Sheet" is available.
- **Single currency per ledger** (default INR, set in the `Settings` tab). Amounts are always positive; the Type column gives the direction.
- **The whole ledger loads into memory.** That is fine for many thousands of rows, not designed for hundreds of thousands.
- **The real Google OAuth / Sheets / Drive flow has not been run end-to-end in CI.** It is covered by request-level tests against a fake Google, and needs the manual checklist in [docs/TESTING.md](docs/TESTING.md) with real credentials.

## Project principles

Keep it small. Keep it understandable. Keep financial data under the user's Google account. Prefer deterministic logic over AI. Mobile UX over feature count.

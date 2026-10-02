# Architecture

## Phase 0 findings

The repository was empty when work started: no commits, no `package.json`, no README. There was nothing to keep or migrate, so V1 is a clean implementation.

## The decision: a static app, no server

```
 Phone (PWA)                                Google (the user's own account)
┌──────────────────────────────┐          ┌───────────────────────────────┐
│ MyXPNS (React, static files) │  OAuth   │ Google Identity Services      │
│                              │ ───────▶ │  → access token (1 h, memory) │
│  UI ─▶ domain logic          │          ├───────────────────────────────┤
│        (validation, rules,   │  HTTPS   │ Sheets API → "MyXPNS Ledger"  │
│         reports)             │ ───────▶ │ Drive API  → MyXPNS/Receipts/ │
│  data/ ─▶ Google repository  │          └───────────────────────────────┘
│       └▶ Demo repository     │
└──────────────────────────────┘
        ▲ served as static files (Firebase Hosting / any static host)
```

MyXPNS runs entirely in the browser. It calls the Google Sheets and Google Drive REST APIs directly, with an OAuth access token that Google issues to the signed-in user.

- **There is no backend, database or server-side session.** The hosting provider only serves static files. MyXPNS operates no system that stores, sees or proxies financial data.
- **Identity is the Google account.** There are no usernames or passwords.
- **Authorization is Google's.** Each user can only reach spreadsheets and files their own Google account can access, and MyXPNS narrows that further with the `drive.file` scope (see [OAUTH.md](OAUTH.md)).
- **There is no multi-tenancy layer.** Each user's ledger is a spreadsheet in their own Drive. Sharing uses Google's Share button.

### Why not Next.js?

Next.js is attractive when you need server rendering, API routes or a server that holds refresh tokens. MyXPNS needs none of these. A server would:

- put OAuth refresh tokens, and therefore long-lived access to people's Drive, on infrastructure we would have to secure;
- add a runtime to pay for, patch and monitor;
- route financial data through a third party.

Vite + React produces a static bundle (~90 KB gzipped JS) that any static host can serve. The trade-off: Google access tokens last about an hour and the browser has no refresh token. After that the user taps **Continue** once to get a new token. For a personal or family app that is an acceptable cost.

## Stack

| Concern | Choice | Why |
|---|---|---|
| UI | React 19 + TypeScript | Familiar, typed, small app |
| Build | Vite 8 | Fast, static output |
| Styling | Tailwind CSS 4 | No component library needed |
| Routing | ~40-line hash router (`src/app/router.ts`) | 6 routes; works on any static host |
| State | One React context (`src/app/AppState.tsx`) | One ledger, loaded once |
| Google auth | Google Identity Services token client | Browser-only OAuth, no server |
| Data | Sheets API v4 + Drive API v3 over `fetch` | No `gapi` client library needed |
| PWA | Hand-written manifest + 70-line service worker | Avoids a Workbox dependency |
| Tests | Vitest + Testing Library + jsdom | |
| Hosting | Firebase Hosting (Google) with staging + production sites | Static, free tier, security headers, same Google Cloud project |

Runtime dependencies: `react` and `react-dom`. Nothing else.

## Source layout

```
src/
  domain/          Pure logic, no I/O. Fully unit-tested.
    types.ts         Canonical Transaction / Category / MerchantRule model
    defaults.ts      Default categories, payment methods, starter merchant rules
    validation.ts    Input validation for a transaction
    merchants.ts     Deterministic merchant normalization + rules
    reports.ts       Monthly totals, category totals, comparisons (in paise)
    receipts.ts      Receipt folder path / filename / file checks
    dates.ts money.ts ids.ts
  data/
    repository.ts    LedgerRepository interface (what the UI needs)
    saveTransaction.ts  Save flow: validate → upload receipt → append → rule
    errors.ts        AppError + user-facing messages
    google/          Real implementation: Sheets + Drive over fetch
    demo/            Demo implementation: seeded sample data in localStorage
  auth/            Google Identity Services, Google Picker, scope list
  app/             App state, ledger selection, router, App shell
  screens/         Home, Transactions, Reports, Settings, Entry, Welcome, Setup
  ui/              Small presentational components
public/            manifest, service worker, icons
```

The UI talks only to `LedgerRepository`. Demo mode and Google mode are interchangeable, so every screen can be built and tested without touching real data.

## Key flows

**Sign-in.** GIS token client → access token, held in memory only → `userinfo` gives the email → find the ledger:
1. the spreadsheet ID remembered on this device for this email,
2. otherwise a spreadsheet MyXPNS tagged earlier (a private Drive `appProperties` marker), so a second device finds it automatically,
3. otherwise the setup screen: **Create My Finance Sheet** or **Connect an existing sheet** (Google Picker).

**Save.** See `src/data/saveTransaction.ts`. A receipt is uploaded first, so its link can be written into the row. If the upload fails, nothing is saved and the user chooses **Try again** or **Save without receipt**. If the row write fails, the uploaded receipt and transaction ID are kept so a retry never uploads twice. If a failure leaves the outcome unknown (a network error during a write), the retry first checks whether the row already exists. Writes are never retried automatically.

**Reads.** The whole ledger is read with one `values:batchGet` call and kept in memory. Totals are computed in the browser. This comfortably handles a family's volume (thousands of rows).

## What is intentionally *not* here

No backend, no database, no Redis, no LLM, no Gmail/SMS ingestion, no analytics, no budgets, no investments, no double-entry accounting, no tax logic, no custom organizations or invitations, no native apps.

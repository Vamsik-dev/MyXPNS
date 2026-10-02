# Testing

```bash
npm test          # all tests, once
npm run test:watch
npm run lint
npm run typecheck
npm run check     # lint + typecheck + tests + production build
```

All tests are deterministic. Dates are fixed (`2026-10-15`), the fixtures are fixed (`src/test/fixtures.ts`), and Google is replaced by a scripted fake `fetch` (`src/test/fakeFetch.ts`). No test touches the network or a real Google account.

## What is covered

| Area | File |
|---|---|
| Transaction validation (amounts, dates, categories by type, payment methods, length limits, control characters) | `src/domain/validation.test.ts` |
| Merchant normalization (DMart / D-Mart / D MART, aliases, history spelling) and rule application, override, upsert | `src/domain/merchants.test.ts` |
| Monthly totals, category totals, previous-month comparison, 6-month series, paise-exact sums | `src/domain/reports.test.ts` |
| Dates, Sheets serial dates, money formatting/parsing, IDs, receipt naming and folder paths | `src/domain/helpers.test.ts` |
| Save flow: expense, received, invalid input, receipt upload failure (retry / save without), ledger write failure without re-upload, duplicate prevention after network failure, merchant rule saving and its failure | `src/data/saveTransaction.test.ts` |
| Google HTTP: bearer header only, no token means no request (unauthorized access), 401/403/404/429/5xx mapping, GET retries, no retries on writes, network errors | `src/data/google/http.test.ts` |
| Sheet row mapping, lenient parsing, unreadable rows, formula text stays text | `src/data/google/schema.test.ts` |
| Sheets/Drive: create ledger, inspect/connect existing sheet without rewriting tabs, load, append, rule upsert, receipt folders + multipart upload, upload failure | `src/data/google/sheets.test.ts` |
| Per-account ledger selection (no cross-account leakage), ledger discovery | `src/app/ledgerSelection.test.ts` |
| UI in demo mode: dashboard totals, Money Spent with automatic categorization, Money Received + Add Another, validation messages, "Always categorize", receipt failure → Save without receipt, invalid receipt, Transactions search/detail, Reports, Settings, leaving demo | `src/app/App.test.tsx` |

## What is NOT covered by automated tests

- **Real Google OAuth, Sheets and Drive calls.** They need a Google Cloud project and a real account. Request shapes are tested against Google's documented REST formats, but the integration has to be checked by hand using the checklist below.
- Google Picker UI.
- Image compression (`src/lib/image.ts`) needs a real browser canvas. jsdom falls back to uploading the original file.

## Manual checklist with real Google credentials

1. `npm run dev` with `.env.local` configured (see SETUP.md).
2. Continue with Google → consent shows only "See your email" and "See, edit, create and delete only the specific Google Drive files you use with this app".
3. Create My Finance Sheet → `MyXPNS/MyXPNS Ledger` appears in Drive with 5 tabs.
4. Add Money Spent with a receipt photo → row appears in Transactions, and the receipt is in `MyXPNS/Receipts/YYYY/MM-Month`.
5. Pick a category manually and tick "Always categorize" → a row is added/updated in `Merchant_Rules`.
6. Reload the page → Continue → the same ledger opens (remembered).
7. Open in another browser → Continue → the ledger is found automatically.
8. Share the sheet with a second account → second account: Connect an existing sheet → entries show **Created By** correctly.
9. Wait more than 1 hour (or revoke at myaccount.google.com/permissions) → saving shows "session expired"; Continue → saving works and the form data is kept.
10. Turn on airplane mode → saving is disabled with an offline message; the app shell still opens.

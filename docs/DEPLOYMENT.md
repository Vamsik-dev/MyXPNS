# Deployment

MyXPNS is a static site, so there is no server to run. The default target is **Firebase Hosting** (Google): free tier, HTTPS, a CDN, custom security headers, and it lives in the same Google Cloud project as the OAuth client. Any static host works (Cloudflare Pages, Netlify, GitHub Pages) if you copy the headers from `firebase.json`.

## One-time setup

1. Complete [SETUP.md §2](SETUP.md#2-google-cloud-configuration-needed-for-real-use).
2. Add Firebase to the Google Cloud project: <https://console.firebase.google.com/> → Add project → choose the existing GCP project.
3. Create **two Hosting sites** (Hosting → Add another site), for example `myxpns-staging` and `myxpns` (or `pathashala-xpns` for a separate Pathashala deployment).
4. Install and log in to the CLI:
   ```bash
   npx firebase-tools login
   ```
5. Map the targets:
   ```bash
   cp .firebaserc.example .firebaserc
   # edit: project ID and the two site IDs
   ```
6. Create `.env.staging` and `.env.production` from `.env.example`, each with that environment's OAuth client ID, API key and project number. Set `VITE_APP_ENV=staging` or `VITE_APP_ENV=production`.
7. In the OAuth client and API key, add the site origins: `https://<site>.web.app` and `https://<site>.firebaseapp.com`.

## Every release — exact checklist

1. `git pull` and check you are on the commit you intend to ship.
2. `npm ci`
3. `npm run check`: lint, typecheck, tests and build must all pass.
4. `npm run deploy:staging`
5. On a phone, open the staging URL and run the manual checklist in [TESTING.md](TESTING.md#manual-checklist-with-real-google-credentials) with a **test** Google account and a **test** spreadsheet.
6. `npm run deploy:production`
7. Open production, sign in, and confirm the dashboard loads and one test transaction saves. Delete the test row in the sheet.
8. If something is wrong, roll back: Firebase console → Hosting → the site → Release history → **Rollback**.

## Separate Veda Pathashala deployment

The Pathashala deployment uses the same code with a different Hosting site, OAuth client (or authorized origin) and `.env` file. After signing in with the Pathashala's Google account, choose **Create My Finance Sheet** (recommended), or connect a spreadsheet that has the MyXPNS tab layout. Then add Pathashala categories (Milk, Vegetables, Maid, Electricity, Donations as RECEIVED/BOTH, …) in the `Categories` tab. The existing Veda Pathashala Finance DB is not modified unless someone explicitly picks it in **Connect an existing sheet**, and even then only after a confirmation listing the tabs that would be added.

## Security headers (from `firebase.json`)

`Content-Security-Policy` allows scripts only from self, `accounts.google.com`, `apis.google.com` and `gstatic.com`, and API connections only to `*.googleapis.com`. Also set: `Cross-Origin-Opener-Policy: same-origin-allow-popups` (required for the Google sign-in popup), `frame-ancestors 'none'`, HSTS, `nosniff`, and a strict `Permissions-Policy`. `index.html`, `sw.js` and the manifest are served `no-cache` so new releases reach installed PWAs promptly.

> The CSP was written from Google's documented domains but has **not yet been verified against real Google sign-in and Picker traffic**. If sign-in or the Picker fails only on the deployed site, check the browser console for CSP violations and widen the matching directive.

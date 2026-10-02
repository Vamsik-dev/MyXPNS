# Setup

## 1. Local development (demo mode, no Google needed)

Requirements: Node.js 20.19+ (22 LTS recommended).

```bash
npm install
npm run dev          # http://localhost:5173
```

With no `.env.local`, the welcome screen offers only **Try the demo**. Demo mode uses seeded sample data (DMart ₹2,350, Barber ₹500, Apollo Pharmacy ₹780, Salary ₹2,50,000, …) stored in this browser only, and shows a yellow **Demo mode** banner. **Settings → Reset demo data** restores the seed.

## 2. Google Cloud configuration (needed for real use)

Do this once per environment (development, staging, production). You can use one Google Cloud project with a separate OAuth client per environment, or one project per environment.

1. **Create or choose a project** at <https://console.cloud.google.com/>. Note the **project number** (Dashboard → Project info).
2. **Enable APIs** (APIs & Services → Library):
   - Google Sheets API
   - Google Drive API
   - Google Picker API (only for "Connect an existing sheet")
3. **OAuth consent screen** (Google Auth Platform → Branding / Audience / Data access):
   - User type **External**. App name `MyXPNS`, support email, and your app domain and privacy policy URL for production.
   - **Data access → Add scopes**: `openid`, `.../auth/userinfo.email`, `.../auth/drive.file`. Nothing else.
   - **Audience**: while the app is in *Testing*, add every Google account that will use it (yourself, family) as a **test user**. Testing mode is fine for personal or family use, with up to 100 test users. To leave Testing, submit for brand verification. No restricted-scope security assessment is needed because `drive.file` is non-sensitive.
4. **Create the OAuth client** (Clients → Create client → **Web application**):
   - **Authorized JavaScript origins**: the exact origin(s), for example
     - dev: `http://localhost:5173`
     - staging: `https://YOUR-STAGING-SITE.web.app`
     - production: `https://YOUR-PRODUCTION-SITE.web.app` (and any custom domain)
   - Redirect URIs are not needed (popup token flow).
   - Copy the **Client ID**.
5. **API key for the Picker** (optional but recommended), under Credentials → Create credentials → API key:
   - Application restriction: **Websites**, with the same origins as above (`http://localhost:5173/*`, …).
   - API restriction: **Google Picker API** only.
6. **Create the env file**:

```bash
cp .env.example .env.local            # development
# edit .env.local:
VITE_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=AIza...           # optional, enables "Connect an existing sheet"
VITE_GOOGLE_APP_ID=123456789012       # project NUMBER, required with the API key
VITE_APP_ENV=development
```

Restart `npm run dev`. **Continue with Google** now appears.

> These values are not secrets in the cryptographic sense: every browser that loads the app receives them. Origin restrictions on the OAuth client and API key are what protect them. Still, they are per environment and are kept out of git (`.env.*` is ignored).

## 3. Environments

| Environment | Env file | Command | Origin |
|---|---|---|---|
| Development | `.env.local` (or `.env.development.local`) | `npm run dev` | `http://localhost:5173` |
| Staging | `.env.staging` | `npm run build:staging` / `npm run deploy:staging` | staging Firebase site |
| Production | `.env.production` | `npm run build` / `npm run deploy:production` | production Firebase site |

Outside production, a small "Environment: staging" banner is shown after sign-in. Use a different test spreadsheet per environment: each account remembers its ledger per origin, so staging and production never mix.

Deployment steps: see [DEPLOYMENT.md](DEPLOYMENT.md).

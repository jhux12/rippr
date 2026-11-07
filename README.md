# rippr

A responsive five-tier pack-opening site with Firebase accounts, Pip branding, an owner-only pack editor, a collection profile, and balance-funded openings using **free test credit**.

## Development

Node.js 22+ and Python 3 are required.

```sh
npm ci --no-audit --no-fund
npm ci --prefix functions --no-audit --no-fund
npm run build:functions
npm run build
npm run serve
```

The static frontend builds to `dist/` and serves on `127.0.0.1:3000`. `src/firebase-client.js` is bundled into the committed `firebase-client.js`; rebuild after SDK changes. Server dependencies live separately in `functions/`. No Admin SDK credentials are included in the website build.

## Account backend setup — required for live wallets and saved items

The public web configuration targets **rippr-2b01c**. The profile is `/profile` or `/profile.html`. The frontend uses the `ripprAccount` callable Function in **us-central1**, which verifies Firebase Authentication automatically. Static deployment alone does not deploy this backend.

From a terminal with project-owner Firebase access:

```sh
npm ci
npm ci --prefix functions
npx firebase login
npx firebase deploy --only functions:ripprAccount,firestore:rules --project rippr-2b01c
```

Firebase Functions deployment requires the project's **Blaze plan**. The CLI's Functions predeploy step synchronizes `src/catalog-model.js` into `functions/catalog-model.js`. Review both the current production rules and the supplied `firestore.rules` before publishing; unrelated collections remain denied. Keep existing Storage rules for owner card uploads. This workspace has no authenticated Firebase administrator session: **production Functions, rules and hosting have not been deployed here**. Deploy the latest static frontend on Vercel or Firebase Hosting after deploying the backend. No private key or CLI token belongs in chat or frontend environment variables.

The server parameter `FREE_TEST_TOPUPS` defaults to `true`, enabling the temporary free top-ups requested by the owner. To pause them, set it to `false` in the Functions environment (`functions/.env.rippr-2b01c`, ignored by Git) and redeploy the Function. Only the server decides whether top-ups are enabled.

### Test-credit behavior

- The header displays the signed-in account's balance and a Pip profile avatar. The same full-width compact navigation is used on home, opening, authentication and profile pages. Collection links open the profile.
- Top-ups add $1–$1,000 of **free, nonredeemable test credit** per request; top-ups cannot take a balance above $10,000. No payment processor is called. Server records use `currency: TEST_USD`.
- Pack purchases deduct the server's price, draw one card per pack using server-side cryptographic randomness, and save winnings **in one Firestore transaction before the reveal animation**. Closing a reveal cannot lose awarded items. Quantities range from 1–5. Missing/disabled/invalid catalogs and changed prices are handled explicitly. Catalog load failures do not offer purchases using silently substituted odds. The server also rejects a stale catalog version even when its price has not changed.
- Admin prices take priority. Missing/unpriced tiers use test defaults: Basic $1.99, Plus $4.99, Premium $14.99, Elite $29.99, Ultimate $99.99. Blank admin prices restore the tier default; explicit `0.00` is supported. Defaults remain illustrative concept cards until the owner replaces them.
- The profile matches the approved navy/cyan concept: compact Pip identity banner, three account statistics, Collection/Activity/Settings tabs, search, Available/Shipping/Sold filters, complete card artwork, rarity badges, individual actions and a sticky bulk-action bar. It loads real account records, with an empty state rather than fabricated winnings. It displays the latest 200 items and 50 activity records.
- Selling available items credits their **saved server value** to test balance. Confirmation is required. Items cannot be sold twice, sold by another account, or sold after a shipping request. Bulk actions support up to 50 items.
- Ship creates an explicitly labeled **test shipping request**, moving items into Shipping. No physical dispatch, shipping charge, address collection or fulfillment integration occurs. Test items never automatically become redeemable goods. Actual fulfillment needs a separate production inventory/operations system.
- Profile editing exposes only the display name. Each account adopts its previously assigned handle as its display name on the next account load, using an idempotent migration through the existing backend. Later display-name edits are preserved. The legacy handle remains internal for compatibility. Desktop navigation and the mobile menu show the account’s Pip picture and display name; the signed-in profile shortcut is hidden in the mobile header. Pip is the initial profile picture. Verification badges reflect Firebase's email verification state.
- Unique operation IDs make successful requests idempotent. Pending IDs persist in sessionStorage across reloads/timeouts; retrying the same action returns its first result instead of charging/awarding twice. Browser balances, values and odds never authorize writes.
- All account state lives under `testAccounts/{uid}` with `items`, `activity`, `operations` and `shipments` subcollections. Clients can read only their own test records and **cannot write balances, winnings or statuses directly**. The authenticated callable Function performs all writes. Test data is intentionally separate from any future real-money ledger.

This is a test economy, not a real-money payment, cash withdrawal or physical-prize service. Do not promote its balances/items into real value automatically. Account services report an error if the backend has not been deployed; they do not substitute localStorage for saved Firebase accounts.

## Firebase Authentication

1. Enable Email/Password in Firebase Authentication. **Google remains paused at the owner's request.** Its button stays disabled until the owner enables the provider and sets `RIPPR_AUTH_FEATURES.google` to `true`.
2. Add the serving hostname under Authentication → Settings → Authorized domains. Add localhost if testing locally.
3. Configure Firebase's password policy if the UI's 12-character requirement should also be enforced by the provider.
4. Replace placeholder Terms and Privacy copy before a public account launch.

Email/password signup, sign-in, password reset, verification/resend/refresh and sign-out use the official Firebase SDK. Auth maintains the browser session; plaintext passwords are not stored by the app. The signed-in authentication panel links to the profile and provides verification controls. Member sign-out clears the wallet/items immediately. No Firebase users are provisioned by repository setup.

## Owner admin

Open `/admin` (also `/admin/`). **jhuxf12@outlook.com** is the sole owner, independently enforced by Firestore and Storage rules through the verified email claim. Register/sign in normally and verify the email first. The account screen provides an owner-only admin link. No browser role/profile field grants admin rights.

The editor manages five catalogs, prices, cards, names, rarities, values, image uploads, grails, per-card odds, enablement and stale-version conflicts. Each pack needs 1–100 cards with chances totaling exactly 100%, stored in basis points. Zero-chance cards are not drawn. JPG/PNG/WebP uploads are public, immutable and limited to 5 MB. Uploads need the repository's `storage.rules` published:

```sh
npm run deploy:rules
```

Catalog reads use Firestore Lite one-time REST requests. Before privileged writes the SDK forces a fresh token so newly verified owners send the correct claim. If permissions fail, confirm the active project/database rules and verification status; `await window.RipprFirebase.refreshUser()` refreshes the cached user/token.

Public odds group obtainable items by rarity and show combined chance plus minimum/maximum item value. Grails, reveals, results and collection items all display rarity. Pack artwork, shimmer and foil share an intrinsic image ratio/alpha outline. Open zooms to the centered stage; drag across the foil or press Enter/Space. Each pack has one rip and one card. Cyan spotlighting, orbit glints, particles and foil glints pause offscreen/in background/navigation overlays; reduced motion uses a static composition. The hero retains its compact rotating design and mobile height. Pip's three poses are in `assets/mascot/`.

## Testing

```sh
npm test
npm run test:accounts
npm run test:accounts:emulator
npm run test:rules
```

Catalog tests cover validation, prices, odds ranges and draw boundaries. Account-service tests exercise the actual server domain logic with a strict in-memory transactional fixture (rollback and read-before-write enforcement), including authentication, top-up limits/disablement, duplicate retries, concurrent purchase attempts, insufficient funds, tampered prices, persistence, cross-account sales/shipping, double sale rejection and display-only profile changes. This fixture does **not** validate Firestore Security Rules, SDK retry behavior or production infrastructure.

The emulator variant runs the same account suite against official Firestore. The Rules suite checks owner/member/visitor permissions, account read isolation, forbidden balance/item writes, catalog constraints and uploads. **The official Firestore/Storage emulator download is blocked in this cloud environment**, so those suites must run where `storage.googleapis.com` downloads are available. No production traffic is used in the local tests.

Start all services with `npm run emulators` (`demo-rippr`, not production), then inject these globals before page scripts for local testing:

```js
window.RIPPR_FIREBASE_CONFIG = {
  apiKey: 'demo-rippr-api-key', authDomain: 'localhost', projectId: 'demo-rippr',
  appId: 'demo-rippr-web', storageBucket: 'demo-rippr.appspot.com'
};
window.RIPPR_FIREBASE_EMULATOR_URL = 'http://127.0.0.1:9099';
window.RIPPR_FIRESTORE_EMULATOR_URL = 'http://127.0.0.1:8080';
window.RIPPR_STORAGE_EMULATOR_URL = 'http://127.0.0.1:9199';
window.RIPPR_FUNCTIONS_EMULATOR_URL = 'http://127.0.0.1:5001';
```

Emulators are supported only on local development hosts. Ports: Auth 9099, Firestore 8080, Storage 9199, Functions 5001. Never inject production credentials for emulator testing.

## Deployment and offline previews

Vercel uses the repository root, `npm ci`, `npm run build` and output directory `dist/`. Rewrites support `/admin` and `/profile`. Firebase Hosting uses the same `dist/` directory; `npm run deploy` builds and deploys Hosting only. Neither static deploy automatically publishes Functions/rules.

```sh
python3 scripts/export-previews.py /workspace/downloads
```

Exports four standalone HTML previews and `rippr-site.zip`. Keep the previews together. Offline previews do not contact Firebase; pack reveals are explicitly offline design previews and the profile shows the sign-in gate. The source ZIP includes Functions source/lockfile but excludes dependency directories, environment files, credentials, CLI logs and deployment outputs.

Manrope and its OFL license are bundled locally. Pack/grail SVGs contain the approved raster art, not vector masters.

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

The public web configuration targets **rippr-2b01c**. The profile is `/profile` or `/profile.html`. Daily rewards are `/rewards` or `/rewards.html`. The frontend uses the `ripprAccount` callable Function in **us-central1**, which verifies Firebase Authentication automatically. Static deployment alone does not deploy this backend.

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
- Profile editing exposes only the display name. Each account adopts its previously assigned handle as its display name on the next account load, using an idempotent migration through the existing backend. Later display-name edits are preserved. The legacy handle remains internal for compatibility. Desktop navigation and the mobile menu show the account’s Pip picture and display name; the signed-in profile shortcut is hidden in the mobile header. Pip is the initial profile picture. Verification badges reflect a verified Firebase phone or the existing email verification state.
- Unique operation IDs make successful requests idempotent. Pending IDs persist in sessionStorage across reloads/timeouts; retrying the same action returns its first result instead of charging/awarding twice. Browser balances, values and odds never authorize writes.
- All account state lives under `testAccounts/{uid}` with `items`, `activity`, `operations` and `shipments` subcollections. Clients can read only their own test records and **cannot write balances, winnings or statuses directly**. The authenticated callable Function performs all writes. Test data is intentionally separate from any future real-money ledger.

This is a test economy, not a real-money payment, cash withdrawal or physical-prize service. Do not promote its balances/items into real value automatically. Account services report an error if the backend has not been deployed; they do not substitute localStorage for saved Firebase accounts.

## Daily rewards and unopened pack inventory

`/rewards` (also `/rewards.html`) uses the approved Pip/case artwork and horizontal prize reel. Rewards is linked from desktop and mobile navigation. Displayed prizes/odds come from the saved reward configuration; the reel animates to the result selected by the server, never a browser-selected prize.

**Testing mode is enabled by default: no 24-hour wait.** Under **Admin → Daily rewards**, turn off **Testing: no cooldown** and save to enforce one claim per rolling 24 hours. The cooldown uses server time. Turning the bypass back on ignores an existing cooldown for testing. Turning it off restores normal cooldown enforcement; the next eligible successful claim starts a fresh 24-hour wait. Duplicate network retries always return the original award, even with the bypass enabled. The earlier deposit-unlock requirement is still deferred; test top-ups do not qualify as deposits or affect eligibility.

The verified owner can add/remove up to 20 prizes, choose balance credit ($0.01–$1,000) or any of the five pack tiers, edit each prize's odds to two decimal places, pause rewards, and toggle testing mode. Odds must sum to exactly 100%; zero-odds prizes are not offered. Version checks prevent stale admin saves and claims using stale displayed odds. Server-side owner claims authorize settings writes, not UI visibility or browser profile fields. Only the callable Function writes `rewardSettings/daily`; the document is publicly readable display data.

Default odds: $0.25 credit 40%, $0.50 credit 30%, $1 credit 20%, Basic pack 8%, Plus pack 2%. Defaults apply only until the owner saves a configuration. Credit awards immediately update test balance. Pack awards are saved under `testAccounts/{uid}/packs` and displayed as **Unopened packs** on the profile. They are separate from collectible cards and cannot be sold/shipped as cards.

Opening an inventory pack navigates to the regular opening screen with a single pack, current odds/grails and normal foil animation. The Function atomically consumes the owned pack and saves one card with a **zero balance debit**. A pack cannot be opened twice, substituted for another tier, or opened by another account. Failed catalog/enablement checks leave it unopened. Cards are saved before animation, so interrupted reveals do not lose winnings. Won packs use their tier's current saved contents when opened. The profile currently displays the most recent 200 pack records, alongside the latest 200 cards.

**Upgrade requires both the updated Function and Firestore rules:**

```sh
git pull origin main
npm ci
npm ci --prefix functions
npx firebase deploy --only functions:ripprAccount,firestore:rules --project rippr-2b01c
```

Use the existing authenticated Firebase terminal/Cloud Shell. Redeploy the latest static frontend as usual. No deployment was performed from this workspace, which has no Firebase admin credentials. No new Function name, billing provider or secrets are needed. The Functions predeploy step synchronizes both catalog and rewards models.

```sh
npm run test:rewards
```

This suite checks weighted boundaries, admin permissions, configuration conflicts, claim idempotency, cooldown boundaries, concurrency, credit awards, pack persistence, zero-cost opening, ownership/tier checks, one-time consumption, catalog failures, and enabling/disabling the testing cooldown bypass. It uses the actual service with the strict transactional fixture described below; official Firestore Rules emulator verification remains blocked by the emulator download policy here. Browser checks use an explicit SDK fixture routed to the actual account service with the transactional fixture. They cover repeat test claims, unopened inventory, foil ripping with no balance debit, admin saves/invalid totals, cooldown restoration, lost-response retries, guest/error states, and layouts at 320/390/768/1024/1440 px. They make no production requests.

## Firebase Authentication

1. Enable **Phone** in Firebase Authentication → Sign-in method (the owner has confirmed this is enabled). Allow the intended countries, including United States (+1), in the SMS region policy. Real SMS uses Firebase's billing/quota and reCAPTCHA requirements.
2. Add each serving hostname under Authentication → Settings → Authorized domains. Add localhost for development as needed. The hosted browser must be able to load Google's reCAPTCHA resources.
3. Keep **Email/Password** enabled for the one-time existing-account linking path. Google remains paused and is not shown in the phone form.
4. Replace placeholder Terms and Privacy copy before a public account launch. The form explains SMS rates and links to the phone-number processing disclosure.

Both Log in and Sign up open the same **phone → SMS verification code** form. Firebase creates an account only after a correct code, or returns the account already linked to that phone. US local numbers default to +1; international numbers require an explicit calling code. Codes stay in memory, never localStorage/sessionStorage. Resends have a 60-second UI cooldown plus Firebase's server-side limits. Errors, expired codes, number changes and reCAPTCHA retries are handled without fake sign-ins. Authentication persists the browser session as before, and sign-out immediately clears the wallet/items.

**Existing accounts:** open **Link phone to an existing account**, sign in once with the existing email/password, then verify a phone. Already-signed-in email users can link directly on the account page. Firebase linking keeps the original UID, balances, winnings, profile and history. If a phone already belongs to a different account, linking stops with an error; there is no automatic merge or reassignment. Use the linking path before signing in with a new phone if you want to retain the old account's data.

The SDK only disables application verification after connecting to a validated localhost Auth Emulator. Production uses Firebase's real reCAPTCHA and SMS checks. No Firebase users, phone numbers or SMS messages are provisioned/sent by repository setup.

If Send code returns `auth/operation-not-allowed`, check both **Authentication → Sign-in method → Phone** and **Authentication → Settings → SMS region policy** in the same Firebase project. The code can represent a regional SMS block even when Phone is enabled; allow United States (+1) for US numbers without removing other intended regions. A billing error needs the project's SMS billing setup checked. The form distinguishes these causes when Firebase supplies a reason and shows safe SDK error references. It never prints raw error messages, phone numbers, verification codes or session data in diagnostics. A bare HTTP 400 stack trace does not identify which setting rejected the request.

**Phone admin migration requires the updated backend and both rules files**, in addition to the frontend:

```sh
git pull origin main
npm ci
npm ci --prefix functions
npx firebase deploy --only functions:ripprAccount,firestore:rules,storage --project rippr-2b01c
```

Deploy the latest static build through the normal hosting flow. Link the owner's phone to the existing owner account on the updated account page to preserve its UID. This workspace has no production Firebase administrator credentials, so the backend/rules must be deployed from the owner's authenticated terminal. Enabling Phone alone does not change those access rules.

## Owner admin

Open `/admin` (also `/admin/`). The sole owner is the Firebase account verified with **+1 765-479-4230**. Firestore, Storage and reward-setting writes independently require Firebase's trusted `phone_number` claim; the backend also binds that token to the request UID. The previous email alone grants no admin access. The account screen provides an owner-only admin link. No browser role/profile field grants admin rights.

The editor manages five catalogs, prices, cards, names, rarities, values, image uploads, grails, per-card odds, enablement and stale-version conflicts. Each pack needs 1–100 cards with chances totaling exactly 100%, stored in basis points. Zero-chance cards are not drawn. JPG/PNG/WebP uploads are public, immutable and limited to 5 MB. Uploads need the repository's `storage.rules` published:

```sh
npm run deploy:rules
```

### Auto odds by expected value

Under **Admin → Packs → Contents → Auto odds**, enter a target average item value in USD or a percentage of the current pack price. The 80%/90%/95% buttons fill a return target. For example, a $10 pack at 90% targets $9 of average item value. The current EV/return is always shown in the collapsed summary when odds total 100%.

Click **Preview odds → Apply to draft → Save changes**. Preview shows every item's current/suggested odds, the rounded EV and its difference from the target. Applying does not save or publish; **Undo generated odds** restores the preceding draft until another pack edit/save. Update pending item edits before generating. Changed inputs invalidate the preview, and existing save/version checks still apply.

Suggestions use a smooth maximum-entropy distribution based on the admin-entered item values, with 0.01% reserved for each included card. Existing 0% items remain excluded unless checked. Targets outside that attainable range are rejected. Odds total exactly 100% at the server's 0.01% precision, so the actual EV can differ from the requested EV; the preview reports the achieved result. EV is an average over many openings, not a guaranteed result or an automatic market-price feed. Each item's saved rarity remains unchanged; published rarity odds derive from the resulting item odds as usual.

The calculator is admin-only frontend tooling (`src/odds-calculator.js`, bundled into `admin/odds-calculator.js` by the normal build). It saves ordinary catalog odds through the existing owner-authorized path. This feature requires only a frontend update; no new Firestore fields, rules or Function deployment are needed.

Catalog reads use Firestore Lite one-time REST requests. Before privileged writes the SDK forces a fresh token so newly verified owners send the correct claim. If permissions fail, confirm the active project/database rules and verification status; `await window.RipprFirebase.refreshUser()` refreshes the cached user/token.

Public odds group obtainable items by rarity and show combined chance plus minimum/maximum item value. Grails, reveals, results and collection items all display rarity. Pack artwork, shimmer and foil share an intrinsic image ratio/alpha outline. Open zooms to the centered stage; drag across the foil or press Enter/Space. Each pack has one rip and one card. Cyan spotlighting, orbit glints, particles and foil glints pause offscreen/in background/navigation overlays; reduced motion uses a static composition. The hero rotates five product showcases: Signature, Daily Discovery, Grail Gallery, Find Your Level, and The First Rip. A single shared stage, subdued lighting, and a dedicated control row keep the compositions consistent. Pack slides use the actual site wrappers rather than generated composite pack illustrations. The grail gallery retains the composition based on the supplied Umbreon VMAX, Charizard Holo and first-edition Mewtwo slabs. Daily and gallery images use SVG presentation viewports around their existing transparent margins; source image pixels remain unchanged. Mobile stays 168px tall with short headlines and no secondary copy. The tier scene shows three legible pack previews on phones and all five on desktop. The wrapper, foil strip, and mystery-card elements on the rip slide share the normal Plus pack asset. Controls, artwork, and CTA have separate layout space; pause/reduced-motion behavior is preserved. Offline homepage exports embed the same assets. Pip's three poses are in `assets/mascot/`.

## Card reveal actions

The opening stage uses a flowing layout for full card artwork, a wrapping name, rarity and two separate actions. Desktop actions sit side by side; mobile actions stack. Single-card reveals omit redundant counters, while batch openings show the current pack and keep one foil rip per pack.

**Add to inventory** replaces View card and continues to the next pack or the result summary. Cards are already persisted by the purchase transaction, so keeping a card never creates another item. **Sell for** confirms the saved item value, calls the existing authenticated sale action with that item's ID, refreshes the account balance and shows the sold result. Mixed batch results distinguish kept and sold cards. Unknown-outcome retries reuse the existing operation ID, and changing accounts resets the reveal and ignores pending responses for the previous account. Offline previews retain the design and keep action, with selling disabled. No backend schema, rules or Function update is required for these controls.

## Shared footer

All five customer pages share the desktop/mobile footer in `partials/footer.html`. `npm run build` synchronizes that partial into the pages; edit the partial rather than individual copies. `footer.css` controls the layout and `footer.js` provides accessible information dialogs and Back to top.

Set `discordUrl`, `instagramUrl` and `supportEmail` in `footer-config.js` when the public destinations are available. Social buttons remain disabled until configured, and Contact explains that support details are coming soon. Help and Shipping describe the current test features; Terms and Privacy remain clearly marked as being prepared and need finalized policies before public launch. Offline previews include the same footer, images and interactions.

## Testing

```sh
npm test
npm run test:accounts
npm run test:accounts:emulator
npm run test:rules
```

Catalog tests cover validation, phone-bound owner claims, prices, odds ranges and draw boundaries. Phone helper tests cover E.164 normalization, invalid formats and six-digit codes with leading zeros. Account-service tests exercise the actual server domain logic with a strict in-memory transactional fixture (rollback and read-before-write enforcement), including authentication, top-up limits/disablement, duplicate retries, concurrent purchase attempts, insufficient funds, tampered prices, persistence, cross-account sales/shipping, double sale rejection and display-only profile changes. This fixture does **not** validate Firestore Security Rules, SDK retry behavior or production infrastructure.

Phone browser validation used the real Firebase SDK and local Auth Emulator for new/returning users, legacy-account linking, UID/data preservation, admin token refresh, phone collisions, resend/change-number controls, expired codes and quota/captcha recovery. Account/reward actions used the actual service with the strict transactional fixture; catalog REST used an explicit authorization fixture. No real SMS messages or production requests were sent.

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

Vercel uses the repository root, `npm ci`, `npm run build` and output directory `dist/`. Rewrites support `/admin`, `/profile` and `/rewards`. Firebase Hosting uses the same `dist/` directory; `npm run deploy` builds and deploys Hosting only. Neither static deploy automatically publishes Functions/rules.

```sh
python3 scripts/export-previews.py /workspace/downloads
```

Exports five standalone HTML previews and `rippr-site.zip`. Keep the previews together. Offline previews do not contact Firebase; pack reveals are explicitly offline design previews and the profile shows the sign-in gate. The source ZIP includes Functions source/lockfile but excludes dependency directories, environment files, credentials, CLI logs and deployment outputs.

Manrope and its OFL license are bundled locally. Pack/grail SVGs contain the approved raster art, not vector masters.

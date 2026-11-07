# rippr

A responsive single-card pack-opening site with five tiers (Basic, Plus, Premium, Elite, Ultimate), rotating hero/carousel, interactive foil ripping, Firebase Authentication, and an owner-only pack editor at `/admin`.

## Development

Node.js 22+ and Python 3 are required for the build/development commands.

```sh
cd /workspace/rippr
npm ci --no-audit --no-fund
npm run build
npm run serve
```

The server listens only on `127.0.0.1:3000` and serves `dist/`. The SDK bundle is committed, so the source checkout can also be served directly for small HTML/CSS edits. After editing `src/firebase-client.js`, rebuild the bundle.

## Firebase project

The client is configured for **rippr-2b01c** in `firebase-config.js`. This is public Firebase web app configuration, not an Admin SDK credential. Analytics is not initialized.

Owner setup in [Firebase Console](https://console.firebase.google.com/project/rippr-2b01c/authentication/providers):

1. Open Authentication and enable **Email/Password**. **Google is paused at the owner’s request.** When the owner is ready, enable Google, select the support email, then set `RIPPR_AUTH_FEATURES.google` to `true` in `firebase-config.js`.
2. Under Authentication → Settings → Authorized domains, allow the hostname serving this site. Verify `rippr-2b01c.firebaseapp.com` and `rippr-2b01c.web.app`; add `localhost` / `127.0.0.1` if testing locally. New projects may not authorize localhost automatically.
3. If the 12-character password requirement should be enforced beyond this UI, configure the Firebase Authentication password policy accordingly.
4. Replace the placeholder Terms and Privacy content before a public account launch.

Live providers and authorized domains have not been verified from the cloud environment: the Firebase API request was blocked by outbound policy and the CLI had no authenticated Firebase session. Required network domains were saved to the cloud environment draft; saving the draft does not apply runtime access or publish it.

## Authentication

- Email/password signup, login, and password reset use the official Firebase SDK.
- New email accounts receive a verification email. Account controls support resend and checking verification status.
- Google is deliberately disabled in both the UI and SDK wrapper. No Google popup is initiated while disabled. Its prepared integration uses Firebase `signInWithPopup` and requires consent for the signup entry point once the owner enables it.
- The account page provides sign-out. Shared navigation shows Account while signed in, including after a reload.
- Firebase maintains its normal browser session. The app does not log or save plaintext passwords.
- Private administration credentials must never be placed in chat, source, or the deploy directory. No service-account key is required by the frontend.
- Collections, pack results, and card values are still demo functionality. Published pack catalogs use Firestore and uploaded card artwork uses Storage. No payment system, saved pull history, or physical-item backend has been added.

## Admin setup

Open **`/admin`** (also available as `/admin/`) for the pack-management dashboard. Its layout follows the approved admin concept and adapts to mobile. It uses the actual site pack images.

**`jhuxf12@outlook.com` is the sole configured owner.** Sign in through the normal account page and verify this email before opening the admin panel. If this email has no Firebase account yet, register it through the normal signup page. No account password has been created or changed by this implementation. A verified owner also gets an **Open admin** link on the account page. Google remains disabled.

Firestore and Storage are already enabled according to the project owner. Before live saving/uploads will work, publish the repository's [Firestore rules](firestore.rules) and [Storage rules](storage.rules) to **rippr-2b01c**. From a terminal authenticated to this Firebase project:

```sh
npx firebase login
npm run deploy:rules
```

Alternatively, paste each rules file into the corresponding **Rules** tab in Firebase Console and publish it there. Review any existing rules first: the supplied files intentionally deny access to unrelated collections and storage paths. These rules do not change Authentication users or Hosting. **Production rules have not been deployed from this environment: the Firebase CLI has no authenticated project-admin session.**

Editing access is checked by the UI and independently enforced by Firebase Security Rules using the verified email in the Firebase-issued token. Changing browser state or sending `isAdmin: true` does not grant database or upload access. No client can assign itself a role. Pack catalogs and card images are public display data; only the verified owner can publish catalogs and create image objects.

Before saving or uploading, the SDK refreshes the sign-in token and checks its verified owner email and UID. A recently verified profile can otherwise still have an older token with `email_verified: false`, which rules correctly reject. Catalog reads and transactions use Firestore Lite's one-time REST requests, avoiding WebChannel streaming connections for these operations.

For a current admin tab with a stale verification token, run `await window.RipprFirebase.refreshUser()` in the browser Console and retry **Save changes**. This refreshes the sign-in without discarding the in-memory draft. If a freshly verified owner is still rejected, confirm the active Firestore rules are published for project **rippr-2b01c**, database **(default)**. The project owner reports publishing the supplied rules in Firebase Console; this workspace cannot independently inspect the active production rules.

The dashboard supports:

- Five independent pack catalogs, card search, adding/editing/removing items, image uploads, value/rarity/chance fields, and grail selection.
- Draft editing followed by **Save changes** to publish the current tier. Unsaved tiers have a dot; the browser warns before leaving unsaved edits. Reloading discards local drafts.
- Integer cents and chance basis points, up to two decimal places, with exactly 100% total odds required by the editor and SDK. Public readers validate saved contents before using them. Each catalog supports 1–100 cards; zero-chance cards are never drawn.
- A transaction/version check that rejects stale saves from another session. Reload before retrying a conflict.
- JPG, PNG and WebP uploads up to 5 MB. Uploads are public and immutable; removing a card from a pack does not remove artwork used by other tiers. The editor also rejects images over 8192 pixels per side.
- An **Enable pack** setting controlling demo openings, a card library across the five tiers, and a link to Firebase Authentication for member administration. The site does not expose Firebase user-list administration credentials in the browser.
- A **Pack price** field under each tier's **Settings**, in USD. Leave it blank to hide the price, or enter `0.00` for an explicit zero price. Prices are saved in integer cents and displayed in the homepage carousel and opening button; selecting multiple packs updates the displayed total. These remain demo openings and do not charge a balance.

**Price setup:** publish the latest `firestore.rules` when upgrading an existing installation. It now permits the optional `priceCents` field, validated as null or integer cents from 0 to 100,000,000. Existing unpriced catalogs remain readable and can still save contents without adding the new field. Storage rules do not need to change for prices.

Pricing/range validation includes grouped and fractional-percent odds, reachable minimum/maximum values, separate tier price drafts, public prices and quantity totals, explicit zero prices, clearing prices, and mobile layouts from 320 px. A real Firebase SDK/local Auth test with fixture Firestore REST responses checked integer-cent persistence, reading prices, preserving a stored price when omitted by a caller, clearing with null, and rejection of invalid prices. The Firestore Rules emulator limitation described below still applies to the new rules checks.

Public pack pages read the saved catalog for the selected tier. The odds table groups obtainable cards by rarity and shows the combined pull chance, minimum item value, and maximum item value for that rarity. Zero-chance items do not inflate the range or appear as obtainable grails. Colored rarity labels also appear on grails, reveals, and result cards. Each pack still reveals exactly one card. If a catalog is missing, demo defaults are shown. If reading fails, the odds caption explicitly says that demo defaults are being used. No admin changes are stored in localStorage or presented as saved after a failed Firebase request.

Defaults are illustrative concept cards matching the admin mockup (60%, 25%, 10%, 4%, 1%). **Draws remain free client-side demos.** Values are illustrative and do not create inventory, charge balances, or award physical items. Paid openings would need a separate authoritative server draw and wallet system.

## Local Auth Emulator

```sh
npm run emulators
```

This runs Auth (`9099`), Firestore (`8080`) and Storage (`9199`) on `127.0.0.1`, using **demo-rippr**, not the live project. Automated browser tests can inject the following before any site scripts load:

```js
window.RIPPR_FIREBASE_CONFIG = {
  apiKey: 'demo-rippr-api-key',
  authDomain: 'localhost',
  projectId: 'demo-rippr',
  appId: 'demo-rippr-web',
  storageBucket: 'demo-rippr.appspot.com'
};
window.RIPPR_FIREBASE_EMULATOR_URL = 'http://127.0.0.1:9099';
window.RIPPR_FIRESTORE_EMULATOR_URL = 'http://127.0.0.1:8080';
window.RIPPR_STORAGE_EMULATOR_URL = 'http://127.0.0.1:9199';
```

The app refuses emulator connections from non-loopback hosts. Do not use production accounts for setup tests. The Google emulator popup also needs `apis.google.com` for Google's iframe library; it was blocked in this environment, so full Google OAuth has not been validated here.

## Vercel

`vercel.json` explicitly selects the static framework, runs `npm ci` and `npm run build`, and publishes `dist/`. Deploy the newest `main` commit; redeploying an older commit will not include this configuration. The Vercel Root Directory must be the repository root. No Vercel environment variables are required for the public Firebase web config already in the source.

## Firebase Hosting

`npm run build` bundles Firebase Auth and copies only the site files into `dist/`. Repository metadata, dependency folders, CLI logs, and tooling are not deployed. `firebase.json` points Hosting to this directory; `.firebaserc` targets rippr-2b01c.

With project access on your own machine, authenticate through the official CLI and deploy:

```sh
npx firebase login
npm run deploy
```

Deployment has **not** been performed. It requires authenticated project access and working Firebase network access. Do not share CLI tokens or private keys in chat.

## Site behavior

- The shared full-width navigation is consistent across home, opening, and account pages. Its mobile dropdown overlays content without moving it.
- A compact wallet balance in the shared header opens the responsive top-up popup. Both show the same $0.00 demo balance; choosing or submitting a top-up does not charge a card or add funds. Payments and account wallets are not connected yet.
- The compact hero rotates four banners. The five-tier carousel supports arrows, keyboard navigation, swipes, and pause. Reduced motion disables autoplay by default.
- Pip is rippr's cyan four-point-star mascot. Three transparent PNG poses in `assets/mascot/` appear in the homepage hero, the compact account welcome panel, collection empty states, and completed-opening header. The hero pose floats gently with the existing banner pause controls; result celebrations animate once, and reduced motion keeps both static. Actual pack artwork remains alongside Pip. `mascot.css` provides the shared responsive placements, and offline previews embed the same assets.
- Each pack reveals one concept card. Pack artwork, shimmer, and foil use the same intrinsic ratio and alpha outline. Open zooms to a centered stage; drag across the foil or press Enter/Space to rip it. Batch openings include one rip per pack.
- The opening stage uses live cyan spotlighting, animated orbit glints, drifting particles, star-marked card backs, a glowing elliptical platform and a soft pack reflection. The top foil catches a moving glint. Rip instructions are accessible to screen readers without visible stage text. Ambient animation pauses offscreen, in background tabs, and while navigation is open; reduced motion keeps a static composition. Rarity colors tint the lighting during a reveal.
- Demo draws use the selected pack's saved item chances. The odds table and grails use that same catalog.

## Offline previews

```sh
python3 scripts/export-previews.py /workspace/downloads
```

The exporter creates three self-contained HTML files and `rippr-site.zip`. Keep the three previews together for navigation. **Offline previews deliberately do not connect to Firebase**; auth actions explain that the hosted site is required. Source ZIPs exclude dependency folders, CLI state/logs, deployment outputs, and local credentials.

## Files and validation

`src/firebase-client.js` wraps the official Firebase SDK. `firebase-client.js` is its generated browser bundle. `account-state.js` shares session state with navigation. Account UI is in `auth.html`, `auth.css`, and `auth.js`; shared navigation is in `navigation.css` / `navigation.js`.

`admin/` contains the admin UI. `src/catalog-model.js` is shared by the Firebase wrapper and the generated `catalog.js` browser bundle; `opening.js` consumes the same validated per-tier contents. `npm test` checks catalog validation and draw boundaries. `npm run test:rules` uses local Firestore/Storage emulators to check the owner/visitor/member access matrix, upload limits, forbidden image types, immutable image objects, and catalog version constraints. Emulator downloads require `storage.googleapis.com`; live catalog/image access uses `firestore.googleapis.com` and `firebasestorage.googleapis.com`.

Admin validation completed: catalog unit tests; real SDK sign-in, verified-owner gating, sign-out, and safe `/admin` return links against the local Auth Emulator; browser checks for editing, upload validation, save failures, separate tier contents, public odds/grails/reveals, and responsive layouts from 320 to 1728 px. A real-Auth-emulator regression check reproduced a verified profile sending an unverified cached token with the previous bundle, then confirmed a fresh verified token and a successful transaction with the updated bundle. The check also confirmed server rejections still fail and the new client makes no WebChannel requests. Catalog/commit responses in these browser checks used an explicit REST/backend fixture. **The Firestore/Storage rules emulator suite could not run here because the required emulator download from `storage.googleapis.com` was blocked with HTTP 403.** Run `npm run test:rules` from an environment that can download the official emulators. The active production rules remain unverified from this workspace.

Pack and grail SVGs are presentation viewports containing the approved raster artwork, not vector masters. The account page reuses the same pack files as the homepage. Manrope and its OFL license are bundled locally.

Validation completed against the **local emulator**: signup, invalid/valid login, session persistence across pages, sign-out, email verification actions and status refresh, password reset and login with the reset password. Google remains disabled in the UI and SDK with no Google requests or popups. Full Google sign-in is intentionally postponed. Live email delivery, provider/domain settings, project administration, and Hosting deployment remain unverified. Existing navigation/pack interactions and offline previews have also been checked in Chromium.

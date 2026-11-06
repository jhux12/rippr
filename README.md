# rippr

A responsive single-card pack-opening site with five tiers (Basic, Plus, Premium, Elite, Ultimate), rotating hero/carousel, interactive foil ripping, and Firebase Authentication.

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
- Collections, pack results, and card values are still demo functionality. No Firestore database, payment system, or physical-item backend has been added.

## Local Auth Emulator

```sh
npm run emulators
```

This runs only the Auth Emulator on `127.0.0.1:9099`, using **demo-rippr**, not the live project. Automated browser tests can inject the following before any site scripts load:

```js
window.RIPPR_FIREBASE_CONFIG = {
  apiKey: 'demo-rippr-api-key',
  authDomain: 'localhost',
  projectId: 'demo-rippr',
  appId: 'demo-rippr-web'
};
window.RIPPR_FIREBASE_EMULATOR_URL = 'http://127.0.0.1:9099';
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
- The compact hero rotates four banners. The five-tier carousel supports arrows, keyboard navigation, swipes, and pause. Reduced motion disables autoplay by default.
- Each pack reveals one concept card. Pack artwork, shimmer, and foil use the same intrinsic ratio and alpha outline. Open zooms to a centered stage; drag across the foil or press Enter/Space to rip it. Batch openings include one rip per pack.
- Demo card odds are 10% rare, 20% uncommon, and 70% common.

## Offline previews

```sh
python3 scripts/export-previews.py /workspace/downloads
```

The exporter creates three self-contained HTML files and `rippr-site.zip`. Keep the three previews together for navigation. **Offline previews deliberately do not connect to Firebase**; auth actions explain that the hosted site is required. Source ZIPs exclude dependency folders, CLI state/logs, deployment outputs, and local credentials.

## Files and validation

`src/firebase-client.js` wraps the official Firebase SDK. `firebase-client.js` is its generated browser bundle. `account-state.js` shares session state with navigation. Account UI is in `auth.html`, `auth.css`, and `auth.js`; shared navigation is in `navigation.css` / `navigation.js`.

Pack and grail SVGs are presentation viewports containing the approved raster artwork, not vector masters. The account page reuses the same pack files as the homepage. Manrope and its OFL license are bundled locally.

Validation completed against the **local emulator**: signup, invalid/valid login, session persistence across pages, sign-out, email verification actions and status refresh, password reset and login with the reset password. Google remains disabled in the UI and SDK with no Google requests or popups. Full Google sign-in is intentionally postponed. Live email delivery, provider/domain settings, project administration, and Hosting deployment remain unverified. Existing navigation/pack interactions and offline previews have also been checked in Chromium.

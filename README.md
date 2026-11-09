# rippr

A responsive five-tier pack-opening site with Firebase accounts, Pip branding, an owner-only pack editor, a collection profile, and balance-funded openings using **free test credit**.

## Landing page

`/landing` is a separate responsive landing page with the shared header/footer, five live pack links, saved homepage grails, and shipping/sign-up links. The hero uses a transparent Charizard slab cutout derived from the supplied reference. It builds into `dist/landing.html`; Firebase and Vercel route configurations are included. No backend or rules changes are required.

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

### Homepage grails

Under **Admin → Settings → Homepage grails**, upload JPG/PNG/WebP card photos (up to 5 MB), set card names and USD values, and add, remove or reorder up to six cards. Click **Save homepage grails** to publish the selection. Uploading a photo alone does not publish the draft. Values are stored in integer cents, including $0; they are manually curated display values rather than a market-price feed. Clearing the list intentionally shows the empty gallery state. Pack odds, prizes and pricing remain independent.

The public gallery reads `settings/homepageGrails`; photos are immutable public objects under `homepage-grails/`. Saves use version checks so another session's edits are not overwritten. Owner UID changes discard pending UI responses. The Firestore and Storage rules restrict writes to the verified owner phone, validate the bounded display data and reject overwrites of published photos. **Deploy both updated rules with `npm run deploy:rules` from an authenticated terminal before using the new settings.** No Function deployment is needed for this feature.

The homepage shows each photo, card name and value and offers a full-image modal. Pack-opening grail previews show the existing pack item's saved value beneath its rarity. Loading failures show an unavailable state rather than substituted saved data. Offline design previews use the existing concept cards and their default values. Model, browser and actual SDK checks cover valid/invalid values, zero values, empty/six-card galleries, saves, conflicts, photo uploads and sign-in changes. The Rules emulator remains unverified here because the environment blocks downloading its uncached JAR from `storage.googleapis.com`.

### Auto odds by expected value

Under **Admin → Packs → Contents → Auto odds**, enter a target average item value in USD or a percentage of the current pack price. The 80%/90%/95% buttons fill a return target. For example, a $10 pack at 90% targets $9 of average item value. The current EV/return is always shown in the collapsed summary when odds total 100%.

Click **Preview odds → Apply to draft → Save changes**. Preview shows every item's current/suggested odds, the rounded EV and its difference from the target. Applying does not save or publish; **Undo generated odds** restores the preceding draft until another pack edit/save. Update pending item edits before generating. Changed inputs invalidate the preview, and existing save/version checks still apply.

Suggestions use a smooth maximum-entropy distribution based on the admin-entered item values, with 0.01% reserved for each included card. Existing 0% items remain excluded unless checked. Targets outside that attainable range are rejected. Odds total exactly 100% at the server's 0.01% precision, so the actual EV can differ from the requested EV; the preview reports the achieved result. EV is an average over many openings, not a guaranteed result or an automatic market-price feed. Each item's saved rarity remains unchanged; published rarity odds derive from the resulting item odds as usual.

The calculator is admin-only frontend tooling (`src/odds-calculator.js`, bundled into `admin/odds-calculator.js` by the normal build). It saves ordinary catalog odds through the existing owner-authorized path. This feature requires only a frontend update; no new Firestore fields, rules or Function deployment are needed.

Catalog reads use Firestore Lite one-time REST requests. Before privileged writes the SDK forces a fresh token so newly verified owners send the correct claim. If permissions fail, confirm the active project/database rules and verification status; `await window.RipprFirebase.refreshUser()` refreshes the cached user/token.

Public odds group obtainable items by rarity and show combined chance plus minimum/maximum item value. Grails, reveals, results and collection items all display rarity. Pack artwork, shimmer and foil share an intrinsic image ratio/alpha outline. Open zooms to the centered stage; drag across the foil or press Enter/Space. Each pack has one rip and one card. Cyan spotlighting, orbit glints, particles and foil glints pause offscreen/in background/navigation overlays; reduced motion uses a static composition. The hero rotates five product showcases: Signature, Daily Discovery, Grail Gallery, Find Your Level, and The First Rip. A single shared stage, subdued lighting, and a dedicated control row keep the compositions consistent. Pack slides use the actual site wrappers rather than generated composite pack illustrations. The grail gallery retains the composition based on the supplied Umbreon VMAX, Charizard Holo and first-edition Mewtwo slabs. Daily and gallery images use SVG presentation viewports around their existing transparent margins; source image pixels remain unchanged. Mobile stays 168px tall with short headlines and no secondary copy. The tier scene shows three legible pack previews on phones and all five on desktop. The wrapper, foil strip, and mystery-card elements on the rip slide share the normal Plus pack asset. Controls, artwork, and CTA have separate layout space; pause/reduced-motion behavior is preserved. Offline homepage exports embed the same assets. Pip's three poses are in `assets/mascot/`.

## Card reveal actions

The opening page uses the compact desktop showcase: the existing pack artwork on the left, a top-aligned name/unit-price panel on the right, 40px quantity buttons, a single purchase button with quantity and total, and rarity odds immediately underneath. Each rarity displays its minimum–maximum reachable item value. Grails span the full row below the showcase, with full, uncropped images; mobile stacks the stage and purchase controls. Saved catalog prices/odds are used throughout, including zero prices. Catalog failures disable opening and show unavailable data rather than substitute examples.

The showcase keeps its original footprint throughout purchase, ripping, charge and flip. The sidebar, odds and grails stay in place; purchase controls remain visible and disabled while opening. The reveal is contained inside the original stage: the card stays horizontally centered, with the landed rarity above and a compact name/value row and two keep/sell buttons below. It does not expand to full width, increase stage height or automatically scroll the page. **Slide to rip** appears above a dashed perforation at the actual 9% foil seam. The 44px target follows the seam, and the line fills as the user slides. **Skip animation** is available after the server awards the card, through zoom/rip/unseal/extraction/color cycle/settling/flip; it cancels pending animation timers and shows that same card immediately. It never makes another purchase, draws a different card or skips the keep/sell decision. Each pack in a batch retains its own reveal. Offline exports include the same layout, helper and skip control.

The shared header balance pill is hidden while signed out or restoring an unknown session. It appears for authenticated users and keeps the existing test top-up behavior. Signing out closes an open top-up dialog and hides the pill across all six customer pages.

The reveal uses the navy rippr card back, outlined landed-rarity capsule, traced edge, soft halo, sparse particles and low oval platform. Batch openings retain a small pack counter. `assets/reveal/rippr-card-back.png` is generated full-bleed artwork; the border, glow, particles and flip are live CSS/SVG effects. The card back preloads during page setup and is embedded in offline exports. The winning image remains the actual catalog artwork, fully contained, with a graceful missing-art fallback. After the flip, its wrapping name, value and two separate actions appear. Keep/sell actions sit in a centered row below the card on desktop and mobile. Long card names scroll within their allotted area and can receive keyboard focus, preserving the full name without moving the controls or changing the page height.

The seven existing rarity names remain unchanged. Shared rarity colors are silver, green, blue, indigo, pink, violet and gold, so Epic is violet everywhere. The centered card lifts from behind the opened wrapper for 900 ms while the wrapper drops away. Its border then smoothly cycles twice through all seven rarity colors, slows down, lands on the saved card’s actual rarity for 480 ms, and flips for 650 ms. The true rarity badge remains hidden until the landing; card details and keep/sell actions remain hidden and inert until the flip finishes. Lower tiers use subtler final lighting. Skip and reduced-motion paths show the same saved card immediately; a session reset cancels the pending timer. Batch openings retain one rip and reveal per pack. **Open again** resets the normal pack view and scrolls to the page top (instantly with reduced motion); reward packs keep their **Back to my items** navigation. No new rewards, prices, odds, account writes or production deployments are introduced.

**Add to inventory** replaces View card and continues to the next pack or the result summary. Cards are already persisted by the purchase transaction, so keeping a card never creates another item. **Sell for** confirms the saved item value, calls the existing authenticated sale action with that item's ID, refreshes the account balance and shows the sold result. Mixed batch results distinguish kept and sold cards. Unknown-outcome retries reuse the existing operation ID, and changing accounts resets the reveal and ignores pending responses for the previous account. Offline previews retain the design and keep action, with selling disabled. No backend schema, rules or Function update is required for these controls.

The main-stage speaker toggle controls the original WAV effects in `assets/audio/` through `opening-audio.js`. Sound is enabled by default but never starts or creates an audio context before a user gesture. Its mute preference is remembered locally. Quiet cues accompany clicks, foil ripping, card extraction, rarity cycling, the flip, the winning rarity and keeping an item. The build cue uses the same 2.28-second timing as the color cycle. Mute, skip, reset, account changes, tab hiding and navigation overlays stop active sounds; unavailable/blocked audio simply skips cues without delaying an opening. Audio files and the engine are included in the build, source ZIP and standalone opening preview.

During extraction, cycling and rarity landing, only the card artwork grows to nearly the pack's height within the existing stage. The card smoothly shrinks and moves back to its prior dimensions during the flip; details and inventory/sell controls appear afterward in their existing positions. Instant skip and reduced-motion paths use the normal reveal dimensions immediately. The stage, sidebar, odds, grails and page height stay fixed.

## Homepage shipping preview

The shipping section sits immediately below **Grails worth discovering**. Its standalone artwork is in `assets/fulfillment/pip-packing.png`; it shows Pip packing a protected card in a branded mailer, labeled **Fulfillment concept**, and the copy states that shipping is currently in testing. The desktop image/copy layout stacks on mobile. The full illustration is contained within the existing frame with fixed intrinsic dimensions, lazy loading and asynchronous decoding, and the offline homepage embeds it.

The trust row links to phone sign-in, actual pack odds and the account collection. The Trustpilot area is an inactive, unscored placeholder with neutral stars and a visible label, as requested; it makes no rating/review-count claim and loads no third-party widget. Replace it with verified profile/rating data when available. The existing hero, carousels, grails and shared footer remain intact.

## Shared footer

All six customer pages share the desktop/mobile footer in `partials/footer.html`. `npm run build` synchronizes that partial into the pages; edit the partial rather than individual copies. `footer.css` controls the layout and `footer.js` provides accessible information dialogs and Back to top.

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

Exports six standalone HTML previews and `rippr-site.zip`. Keep the previews together. Offline previews do not contact Firebase; pack reveals are explicitly offline design previews and the profile shows the sign-in gate. The source ZIP includes Functions source/lockfile but excludes dependency directories, environment files, credentials, CLI logs and deployment outputs.

Manrope and its OFL license are bundled locally. Pack/grail SVGs contain the approved raster art, not vector masters.


## How it works page

`/how-it-works` and `how-it-works.html` serve the illustrated four-step guide. The compact Pip intro, connected step cards, CTA row, keyboard-accessible FAQ and compact shared-footer presentation follow the approved mockup, with the testing strip omitted. Actual Basic/Premium/Ultimate pack assets compose the pack illustration. The other three transparent illustrations are in `assets/how-it-works/`; SVG presentation viewports fit the original images without modifying their pixels. Mobile uses compact illustrated rows. All existing customer headers link to the guide; shared authentication, profile, balance and top-up behavior remain in place. The build includes the clean route for Vercel and Firebase Hosting. No Functions or rules deployment is required.

The preview exporter now creates `rippr-how-it-works.html`, embeds its artwork, fonts, Pip and pack images, rewrites sibling links, and includes the page in the source ZIP. Browser checks cover 320–1920px layouts, keyboard FAQ controls, desktop/mobile navigation, guest/member header state and support/legal dialogs using a read-only SDK fixture.

### Delivery and account pages

`/shipping` explains the request process with original Pip and packaging artwork. `/order-tracking` reads the signed-in account's shipping requests, stored item and address snapshots, and recorded status. Existing requests remain test requests; this update does not dispatch parcels, charge shipping, create carrier tracking or send notifications. Missing carrier details stay empty until recorded by a future fulfillment integration.

`/account-settings` saves display name, optional contact email, delivery address, profile photo and preferences through the account Function. The phone change dialog verifies the existing number before verifying the replacement, preserving the account UID. Profile photos are public, immutable, member-owned JPG/PNG/WebP uploads up to 5 MB. Saved addresses and shipping requests remain under the account's private Firestore path. Communication switches save preferences only; no notification delivery service is enabled.

After pulling this update in an authenticated Firebase terminal, deploy the account Function and Storage rules before using the new saves/uploads:

```sh
cd ~/rippr
git pull origin main
npm ci
npm ci --prefix functions
npx firebase deploy --only functions:ripprAccount,firestore:rules,storage --project rippr-2b01c
```

Publish the static build through the existing hosting workflow. This development session does not deploy Firebase or publish the environment.

### Shipping request popup and admin tracking

My items → Ship opens the responsive request dialog with selected card images, the account's saved address or an address entered for this request, and a pending quote summary. No shipping provider, quote, insurance coverage, delivery promise or shipping charge is created. Submit saves the chosen address snapshot and takes the customer to tracking.

Admin → Shipping requests shows the latest 100 new requests with search/status filters, item and address details, and manual status/carrier/tracking updates. Older requests can be opened using the customer UID and full request ID; saving indexes them in the queue. Shipped/delivered require carrier and tracking fields. Concurrent edits require reloading; repeated submissions cannot duplicate a request or status update. The queue and updates are served only through the verified-owner callable Function, and customer records remain private. This does not book shipping or buy labels, and test requests remain tests.

Deploy `functions:ripprAccount` after pulling this change. Existing Firestore/Storage rules already deny access to the private queue; no rules edits are required for this feature. Connecting a shipping provider and a final quote/payment confirmation remains future work.

### Help Center, About and Contact Support

`/help-center` provides searchable answers with topic filters and links to the real account, packs, rewards and shipping pages. `/about` contains the brand story and pack/guide links. Both are public, with original Pip illustrations extracted as separate artwork from the approved mockups. Shared footer links now open these pages and `/contact-support`; the main navigation remains Packs, Rewards, My items, How it works.

Contact Support requires sign-in to submit and maintains a private in-site conversation. Members can send a topic, contact email, message, optional shipping reference and one optional PNG/JPG screenshot up to 5 MB. The form saves a ticket and displays it under Your support requests. Admin → Support inbox lists the newest 100 tickets, supports search, replies and Open/Pending/Resolved statuses. Members see their newest 50 threads and can refresh/reply. Notifications are delivered in the website only; no email, SMS or external helpdesk integration is enabled. Contact email is stored for support context, not used as a delivery promise.

Tickets live under `testAccounts/{uid}/supportTickets`; the admin index at `supportQueue/root/requests` is accessible only through verified-owner Functions. Attachments at `support-attachments/{uid}/{ticketId}/screenshot.png` (or `.jpg`) require the sender's or verified owner's authentication to read, are immutable, and are never exposed using public download-token URLs. Conversations are bounded to 40 messages, submissions have a one-minute cooldown and replies have a short cooldown. Duplicate retries are idempotent and stale conversation versions must refresh. Old orphan uploads are not automatically cleaned up.

After pulling, deploy the account Function **and Storage rules** from an authenticated terminal:

```sh
cd ~/rippr
git pull origin main
npm ci
npm ci --prefix functions
npx firebase deploy --only functions:ripprAccount,storage --project rippr-2b01c
```

No new Firestore rule changes are required. Publish the static build through your normal hosting workflow. Private screenshot viewing uses authenticated Storage SDK downloads; if your bucket restricts CORS, allow your actual website origins for GET downloads in the bucket's CORS configuration. Security Rules still require authentication regardless of CORS. The official Firestore/Storage emulator suite requires its downloadable emulator artifacts; the current environment cannot fetch the Firestore JAR, so rule tests should be run in an environment with those artifacts available.

Mobile sign-in uses a compact welcome strip, consistent form insets and touch-sized fields. Verified phone sign-ins return immediately to a validated same-origin `next` destination, then a same-origin referrer, or `/` as the fallback. Site sign-in links and purchase/reward/top-up entry points preserve the original page query and anchor. Sign-in-page loops and external return URLs are rejected. Existing email-only accounts retain the phone-linking step so their UID, items and balance are preserved. This is a frontend-only change; no Firebase deployment or rules update is required.

The pack-opening grails section uses a compact single-row carousel: four cards on desktop, three on tablet and a swipeable card with the next tile visible on mobile. All obtainable grails are included, using the existing catalog artwork, rarity colors and values. Names with spaced dash separators are shortened for tiles; complete names and uncropped artwork are available in a keyboard-accessible preview dialog. Desktop arrows, mobile dots and keyboard scrolling reflect actual scroll positions. No backend or rules deployment is required.

### Referrals

The Rewards page retains the original daily case and possible-prize display, with a standalone referral card underneath. Other collection reward features have been rolled back. Members can copy invite links or apply one non-self code before their first opening. A qualifying **test-balance** purchase credits both accounts once in the same transaction; free inventory packs do not qualify. Defaults are $0.25 per person, a $1 minimum purchase and 20 bonuses per referrer. This is not verified real-deposit qualification; real-payment and anti-abuse integration remain future work.

Admin → Referrals controls the enabled switch, credit amount, purchase minimum and per-referrer cap. Existing invite codes, bindings and payout history remain valid. Previously saved referral settings are read from the legacy collection reward configuration until saved into `rewardSettings/referrals`. The retired collection reward actions no longer award anything. Existing earned packs and account records are preserved.

Deploy the updated account Function after pulling:

```sh
cd ~/rippr
git pull origin main
npm ci
npm ci --prefix functions
npx firebase deploy --only functions:ripprAccount --project rippr-2b01c
```

No new Firestore or Storage rules are needed. Validation: `npm run test:referrals`, `npm run test:accounts`, `npm run test:rewards`, and responsive browser tests with an isolated account database.

Invite entry now lives in the shared phone sign-up form as an optional field. Shared invites open `auth.html?mode=signup&ref=CODE`; older Rewards-page invite links still carry the code into sign-up. After successful phone verification, the page fetches current referral settings and binds an eligible code before returning to the original page. Invalid or unavailable codes can be corrected without another SMS, or skipped. Existing accounts that already opened a pack or already applied an invite sign in normally. The Rewards page retains invite sharing and referral status, without an invite-entry form. No backend or rules deployment is needed for this change.

Homepage Grails worth discovering uses a single horizontal row instead of stacked rows. When there are more cards than fit, it advances every five seconds and loops. Previous/Next and Play/Pause controls, native touch scrolling and keyboard arrow navigation are supported. Automatic rotation pauses on hover, keyboard focus, offscreen placement, hidden tabs, navigation overlays and card previews. Manual controls and touch interaction pause rotation until restarted; reduced-motion preferences start it paused. Saved admin images, names, values and full-card previews remain unchanged.

## Limited-time packs and tier stages

The homepage keeps its existing pack stack and sizing. **Core packs / Limited time** switches between the five core tiers and Icy Rush; a collection remembers its selected pack during switching. A one-pack collection is centered and disables its unnecessary rotation controls. Core prices and catalogs are unchanged. The separate `/landing` page continues to present the five core tiers.

Icy Rush (`icy-rush`) uses `assets/seasonal/pack-icy-rush.png`. Its initial catalog is disabled and unpriced; it becomes purchasable only after the owner sets its cards, odds and price in **Admin → Packs → Icy Rush**, enables it, and saves. No seasonal price, expiry or inventory count is fabricated. Daily reward settings can also award Icy Rush, with its image and name retained in account inventory. One pack still yields one card.

For live catalog editing and balance purchases, deploy the updated backend and rules from an authenticated checkout (not performed by this workspace):

```sh
git pull origin main
npx firebase deploy --only functions:ripprAccount,firestore:rules --project rippr-2b01c
```

Stage atmospheres share the same geometry and reveal controls: Basic silver studio, Plus cyan currents, Premium purple prism, Elite coral energy, Ultimate gold celestial rings, and Icy Rush frost/snowflakes. Actual card rarity controls reveal colors. Mute, reduced motion, ambient pausing, batch skip, and per-card sell/keep actions are retained. Unconfigured prices render as a dash, not a free offer. Catalog/account/reward tests and browser checks cover the seasonal flow; the rules emulator download remains blocked by the environment's network policy for `storage.googleapis.com`.

## Full-screen opening view

A successful purchase (or owned-pack opening) expands the existing tier-themed arena into a viewport-sized native dialog. No browser Fullscreen API permission is required. The stage remains large through rip, suspense and per-card keep/sell actions; finishing the batch restores the normal results page. The top-right control or Escape returns to the inline stage without purchasing again, and the same control can expand it again. Payment failures leave the normal page visible. Account changes and resets close the layer, restore the original arena/live region, cancel its entrance animation, and unlock page scrolling.

`opening-theater.css` defines the responsive composition, including compact landscape. `opening-foil.js` and `opening-foil.css` retain the source pack art and dimensions while adding a progressive jagged cut, curled strip, reflective underside and brief release motion. Drag in either direction, use the keyboard rip control, or skip the remaining batch animations. Reduced motion removes the entrance and foil-release movement. Native dialog focus handling keeps sale confirmations above the enlarged stage. These are frontend-only changes; no additional Firebase deployment is required.

## Personal museums and community collections

Open **My items → My museum** to curate up to six available cards, arrange their display order, and save a private gallery. Publishing requires explicitly enabling **Share with the community** in the editor. The museum uses the generated `assets/museum/gallery-room.png` architectural background with live card images, glass cases, plinths, Pip, a featured-card rail and full-image inspection. No sample collector galleries are published automatically.

**Community collections** is linked from My items, each museum, and the homepage grails section. `/community` browses published museums with recent/most-liked sorting, cursor pagination and a filter for the pages explored. `/museum?user=UID` is the shareable public view. Guests can browse; signed-in collectors can like or unlike a museum once per account. Self-likes are blocked. Counts are authoritative server transactions, and retrying a like does not add another one.

`ripprMuseum` serves these projections through callable Functions. It validates ownership of every selected card, omits sold/shipping cards at read time, binds writes to the initiating account, checks saved versions and exposes no balances, contact details, address data or private inventory. Private drafts and likes live in server-managed documents; clients cannot write the directory or counts directly. Unpublishing immediately removes a museum from public reads/browsing while preserving its private draft.

Deploy the new function and latest rules from an authenticated checkout before using live museums:

```sh
git pull origin main
npm ci
npm ci --prefix functions
npm run build:functions
npx firebase deploy --only functions:ripprMuseum,firestore:rules --project rippr-2b01c
```

The normal frontend build includes both pages; Firebase/Vercel route configurations support `/museum` and `/community`. No additional secrets or composite indexes are needed. Run `npm run test:museum` for ownership/privacy/like/pagination tests. Existing account, rewards, referral and catalog tests and mocked browser flows pass. Security Rules emulator tests are provided but remain unverified here because the uncached emulator JAR download from `storage.googleapis.com` is blocked by the environment policy. No production deployment was performed in this workspace.

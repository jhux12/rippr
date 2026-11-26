# Homepage recent pulls

“Fresh from the machine” sits below the vending machine and above the grails section. It defaults to **Biggest this week**, the 12 highest award-time card values across the rolling last seven days, with a **Latest** switch for chronological pulls. Compact tiles show original artwork, site rarity/color, Near Mint or explicit slab grade, value and relative time. Inspect opens a responsive card dialog with a source-pack thumbnail and link; the tile also retains a native pack link. Mobile uses a horizontal swipe strip with accessible arrow/keyboard controls. No museum spotlights, welcome panel or additional Pip interactions were added.

## Trusted records

Successful paid and owned/reward-pack openings stage a separate card-only projection inside the existing award transaction. There are no additional reads or shared feed document. Wallet, inventory, award and projection commit together; a failed opening cannot create activity and an operation replay cannot duplicate it.

Each public record contains only name, artwork URL, rarity, award-time value, pack ID, award timestamp, test marker, optional grading and an expiry timestamp. Its document ID is a SHA-256 digest of ledger/account/operation/index; account IDs, customer names, phone/email/address, private item IDs and operation IDs are omitted. Existing public catalog images are supported; illustrative defaults, placeholders, card backs and recognized profile/support/private-upload paths are excluded. Invalid projection data is skipped while preserving the legitimate award.

Test and live records use `testRecentPulls` and `liveRecentPulls`. The verified runtime selects the collection, and both shared validation and rendering check its test marker. Sandbox results are explicitly labeled “Test pulls.” There is no historical backfill, artificial activity, customer-name display, like count or claimed live attendance.

The public SDK helper makes a bounded seven-day query: Biggest filters nonnegative values and orders by `valueCents desc, pulledAtMs desc`; Latest orders by `pulledAtMs desc`. Ranking occurs before the 12-record limit in Firestore, so older high-value pulls are not lost behind newer low-value pulls. Sort and runtime have independent 60-second caches and in-flight deduplication. Explicit refresh keeps the current rail while browsing and offers Show updated pulls. Retry and page-return refresh remain supported. It has no background polling or listener. Rules allow recent lists of at most 12 records, deny direct document gets and every browser write, and leave private account data protected. The Rules age limit is 14 days to allow clock-skew margin around the client's seven-day query. The two descending value/time composite indexes are defined in `firestore.indexes.json`. Existing Rules allow both bounded queries without changes. Until indexes are ready, Biggest presents an honest unavailable state with Latest available; it never relabels a partial latest-only result as the biggest.

Images now use an explicit three-request queue instead of browser-native lazy-loading thresholds. The first visible row loads as soon as feed data renders, even before the page is scrolled down. The queue warms approximately two cards ahead (and one behind), decodes before showing artwork, and reuses the original URLs/browser cache. Distant cards have no source until near the viewing window. A static card silhouette reserves the artwork space during loading. Scroll/resize and page visibility drive the queue; there is no continuous animation or polling. Removed/replaced rails cancel pending retries. Images retain the bounded CDN-recovery helper and a readable failure state. Feed loading/error/empty states never substitute demo cards. Runtime changes invalidate rendered/in-flight results.

## Weekly ranking update deployment

The new frontend needs the composite indexes. If the account/rules deployment was already completed for recent pulls, only deploy these indexes:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npx firebase deploy --only firestore:indexes --project rippr-2b01c
```

Allow Firestore index building to complete before checking Biggest. Latest continues using its existing single-field index. No new Function or account deployment is needed for this UI/ranking update. Values are award-time card values, not guaranteed cash or a current resale quote. Default screenshots are in `/tmp/rippr-biggest-pulls-{390,1440}.png`; dialog screenshots are in `/tmp/rippr-pull-preview-{390,1440}.png`, using local fixtures only.

## Original feed deployment

The frontend follows the normal main-branch/Vercel build. Apply the account service and new Rules from Cloud Shell:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npm run test:rules &&
npx firebase deploy --only functions:ripprAccount,firestore:rules,firestore:indexes --project rippr-2b01c
```

New qualifying openings populate the feed after deployment. Existing awards are not republished. No new Function, secret, provider or payment configuration is required.

Enable Firestore's managed TTL deletion for the new seven-day expiry field:

```bash
gcloud firestore fields ttls update expiresAt --collection-group=liveRecentPulls --enable-ttl --project=rippr-2b01c --quiet &&
gcloud firestore fields ttls update expiresAt --collection-group=testRecentPulls --enable-ttl --project=rippr-2b01c --quiet
```

TTL is asynchronous; client/Rules age checks bound display/access independently of physical deletion. TTL setup was not run against production here.

## Verification

- 303 domain tests passed, including award atomicity, failed/replayed/concurrent requests, reward opens, mode isolation, grades, TTL and privacy whitelists.
- Browser checks passed at 320/390/768/1440px for responsive cards, colors/condition, source links, 44px controls, keyboard/native scrolling, image recovery, empty/error/forced retry, unsafe content, source/runtime changes, no polling and zero purchase calls.
- Firebase helper build and isolated query/cache/concurrency/failure checks passed.
- Rules tests were added for anonymous/member/owner bounded reads, direct-get/write denial and private-account protection. They could not run in this workspace because both official emulator artifact download endpoints returned proxy HTTP 403. The Cloud Shell deployment command runs them before deployment.
- Build/site checks passed. Screenshots in `/tmp/rippr-recent-pulls-{390,1440}.png` use isolated fixture records and artwork, not production activity.

Weekly update verification: isolated SDK-helper checks cover sort-specific queries/caches, concurrent deduplication, forced refresh and runtime rejection; the real Firebase SDK accepts the multi-range query. Browser checks at 320/390/768/1440px cover default Biggest, Latest, dialog focus/Escape, pack links, values/time, stable refresh and prior safety cases. The Rules suite now includes the ranked query, but could not run here because the emulator artifact download was unavailable. Build/site checks passed.


## Diagnose weekly ranking after deployment

One qualifying award is enough to populate the list. An empty list and a failed query are different states; “Biggest pulls are taking a moment” means the request failed. Deployment completion does not establish that an asynchronous Firestore index has reached READY.

Run `node scripts/check-recent-pulls.mjs rippr-2b01c` in Cloud Shell. It issues the same two anonymous, bounded public queries used by the page and prints only counts and error statuses/messages. It then reads matching live-index metadata using the existing Cloud Shell account, without printing credentials. No account/private collection, wallet, payment or shipping records are accessed or changed. Optional third argument `test` checks the isolated test collection. READY plus successful public queries distinguishes index readiness from browser/runtime/cache issues; CREATING requires waiting, missing indexes require deployment, and PERMISSION_DENIED points to the deployed Rules. Share this diagnostic's output before changing the ranking algorithm or fabricating a latest-only fallback.

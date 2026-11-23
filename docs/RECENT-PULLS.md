# Homepage recent pulls

“Fresh from the machine” sits below the vending machine and above the grails section. It displays up to 12 recent card awards from the last seven days, with the original artwork, site rarity/color, Near Mint or explicit slab grade, and a link to the source pack. Mobile uses a horizontal swipe strip with accessible arrow/keyboard controls. No museum spotlights, welcome panel or additional Pip interactions were added.

## Trusted records

Successful paid and owned/reward-pack openings stage a separate card-only projection inside the existing award transaction. There are no additional reads or shared feed document. Wallet, inventory, award and projection commit together; a failed opening cannot create activity and an operation replay cannot duplicate it.

Each public record contains only name, artwork URL, rarity, award-time value, pack ID, award timestamp, test marker, optional grading and an expiry timestamp. Its document ID is a SHA-256 digest of ledger/account/operation/index; account IDs, customer names, phone/email/address, private item IDs and operation IDs are omitted. Existing public catalog images are supported; illustrative defaults, placeholders, card backs and recognized profile/support/private-upload paths are excluded. Invalid projection data is skipped while preserving the legitimate award.

Test and live records use `testRecentPulls` and `liveRecentPulls`. The verified runtime selects the collection, and both shared validation and rendering check its test marker. Sandbox results are explicitly labeled “Test pulls.” There is no historical backfill, artificial activity, customer-name display, like count or claimed live attendance.

The public SDK helper makes one bounded seven-day query ordered by `pulledAtMs`, caches for 60 seconds, and supports explicit retry/return refresh. It has no background polling or listener. Rules allow recent lists of at most 12 records, deny direct document gets and every browser write, and leave private account data protected. The Rules age limit is 14 days to allow clock-skew margin around the client's seven-day query. No composite index is required.

Images use the existing bounded CDN-recovery helper and a readable failure state. Feed loading/error/empty states never substitute demo cards. Runtime changes invalidate rendered/in-flight results.

## Deployment

The frontend follows the normal main-branch/Vercel build. Apply the account service and new Rules from Cloud Shell:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npm run test:rules &&
npx firebase deploy --only functions:ripprAccount,firestore:rules --project rippr-2b01c
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

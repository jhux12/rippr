# Shippo shipping setup

The implementation is prepared. This workspace has not accessed your Shippo account, purchased postage, or changed production shipping settings. Quotes and customer shipping payments/label purchases default off. No origin or parcel size is guessed from the business mailing address.

## Pricing and customer flow

Customers pay the approved tracked carrier quote using site credit, without markup. Shipping fees earn neither Spark Points nor referral qualifying spend. Cards are reserved by the initial request, which does not charge a fee. Quotes use the immutable request address, selected card values and configured raw/graded parcel presets.

Quotes expire after 15 minutes. A customer must select a saved service and approve its exact amount; stale, altered or expired quotes cannot debit the wallet. Cancellation before payment releases the cards. Paid requests require staff review. Charges and eligible refunds use the existing wallet ledger, preserving original credit buckets.

Only admin can buy the paid rate's label. A label means ready for packing, not dispatched. Mark shipped only after carrier handoff. Official carrier links and customer/admin refresh controls provide tracking; this release has no background tracking webhook/polling job. Delivery exceptions need staff review.

## Test-key-only setup

Private shipping settings now use ripprAccount, so a live Shippo key is not needed for the owner sandbox check.

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npx firebase functions:secrets:set SHIPPO_TEST_API_KEY --project rippr-2b01c &&
npx firebase deploy --only functions:ripprAccount,functions:ripprShippoTest --project rippr-2b01c
```

Enter the actual shippo_test_ token only at the hidden secret-value prompt. After frontend/function deployment, refresh Admin → Shipping requests → Shippo setup. Save the actual sender address/phone and measured parcel presets. Leave both enable switches OFF. Click Create sandbox quote & TEST label. Test labels are not valid for dispatch; this sender-to-distinct-destination check changes no wallet or shipment records. Keep the storefront live. Do not create a dummy live key or deploy live shipping yet. Actual API connectivity remains pending until this owner-run check succeeds.

## 1. Create and connect Shippo

Create a Shippo account and enable the carriers you intend to use. Obtain a test API token beginning shippo_test_ and a live token beginning shippo_live_. Enter values only at hidden Firebase prompts, never in source files or chat.

    cd ~/rippr &&
    git pull --ff-only origin main &&
    npx firebase functions:secrets:set SHIPPO_TEST_API_KEY --project rippr-2b01c &&
    npx firebase functions:secrets:set SHIPPO_LIVE_API_KEY --project rippr-2b01c &&
    npx firebase deploy --only functions:ripprAccount,functions:ripprLiveShipping,functions:ripprShippoTest --project rippr-2b01c

Keep the storefront in its current live mode. Do not rerun prepare or switch the storefront to test mode to test Shippo. The owner-only ripprShippoTest endpoint uses only the test token and reads the selected mode's private shipping setup; it does not change wallets or shipment records. The optional ripprShipping endpoint is for a test-mode storefront and need not be deployed for this live rollout.

Private shippingSettings and shippingProviderJobs roots are live-prefixed in live mode. Existing default-deny Firestore Rules protect them; tokens remain in Secret Manager. No Rules relaxation is required.

## 2. Configure measured parcels privately

In Admin → Shipping requests → Shippo setup:

- Enter the actual dispatch/return address, sender phone and optional sender email.
- Enter raw-card and graded/mixed parcel dimensions in inches, empty packaging weight in ounces, item/slab weight in ounces, and the maximum number of cards/slabs that actually fit.
- Mixed parcels use the graded parcel's dimensions/packaging weight plus the raw and graded item weights for the actual counts. Weight is rounded up to hundredths of an ounce. Requests exceeding capacity are rejected.
- Keep the manual insurance-review limit conservative: the default is $100 total recorded item value. No additional insurance is automatically purchased. High-value requests require a manual insurance review.
- Allowed tracked service tokens initially include usps_ground_advantage and usps_priority. Only configured services returned by your connected Shippo account are offered. No untracked-letter service or fabricated quote is substituted.
- Keep both enable checkboxes off while testing, then save.

The initial service area is the contiguous US and DC, matching the approved fulfillment plan. State names/codes and ZIP structure are checked; this is not a carrier deliverability guarantee.

## 3. Test without buying live postage

Click Create sandbox quote & TEST label. It quotes a raw-card parcel using the configured sender as a test destination, then requests a test label with the test token. The separate PDF is marked TEST and must not be used for dispatch. It creates no site-credit movement and never uses the live token.

Confirm actual Shippo responses return rates and a successful test label. Automated tests use provider fixtures; official documentation downloads here returned HTTP 403, and actual credentials were unavailable. Account-specific carrier/API behavior must therefore be verified in this sandbox step.

Then enable carrier quotes only, save, and inspect a real carrier quote on a controlled request. No shipping fee or live label can be purchased while the payment/label checkbox is off. Refresh quotes after changing settings.

## 4. Controlled live shipping

After sandbox and quote checks, explicitly enable customer shipping payments/admin label purchases. Approve one controlled quote, confirm one wallet debit, then use Buy approved label in its admin editor. Verify carrier, sender, destination, dimensions and weight before dispatch.

If package/address requirements differ, do not use the old parcel's label. Cancel an unpaid request, or review/refund an unfulfilled paid request and create a new request/quote.

## Timeouts and refunds

Label purchases are reserved before the external POST. Repeated clicks return the saved state and never automatically purchase a second label. If uncertain, inspect Shippo for the saved metadata reference, enter its transaction ID, and refresh. Mode, rate and reference must match.

Purchased labels block automatic fee refunds. Pending or uncertain label purchases also block dispatch updates. With no purchased label, or a verified failed transaction, Return shipping credit & cancel restores original credit sources and releases cards atomically. It is a site-credit restoration, not a Stripe refund or Shippo postage void. For a purchased but unshipped label, request its unused-label refund in Shippo. After Shippo confirms SUCCESS, enter the refund ID and reconcile it in admin; mode, transaction and metadata must match before credit can be returned. Dispatched labels and delivery disputes remain manual support cases.

If the original purchased funding has already been refunded and left payment debt, the returned purchased portion first repays that debt; only the remainder becomes spendable. Other credit sources and unrelated account holds retain their existing treatment.

Do not erase reservations merely to retry. Reconcile the card ownership, approved fee, provider job and wallet ledger together.

## Validation

Domain fixtures cover access control, stale/tampered quotes, same/different-ID payment retries, uncertain/failed/successful labels, original credit sources, refunds, cancellation, tracking and credential modes. Browser flows cover quote/payment and admin setup/label/privacy behavior at 320/390/1440px. No real payment, label or account setup was performed here.

## Deploying unrelated functions before Shippo access

Shippo secrets use endpoint-specific named Secret Manager bindings. They are not global defineSecret parameters, because Firebase resolves those for the entire codebase before applying a function filter. Account-only deployments therefore do not require Shippo keys. Deploying the shipping endpoints themselves still requires their real Secret Manager versions; missing runtime keys reject provider requests before any network call. Do not create dummy tokens. Keep shipping disabled until actual account verification is complete.

## Suggested automatic packaging

New unsaved setups prefill raw-item weight at the owner's planning value of 1 oz and slab weight at 3 oz. Existing saved setups retain their measurements until the owner clicks **Use suggested packaging · cards 1 oz / slabs 3 oz** and saves. The button leaves the sender address and shipping enable switches unchanged.

| Preset | Suggested external size (in) | Estimated empty packaging (oz) | Raw-only capacity | Slab-only capacity |
| --- | --- | --- | --- | --- |
| Rigid padded mailer | 8 × 6 × 1 | 1.5 | 3 | 0 |
| Small protective box | 8 × 6 × 3 | 3 | 10 | 2 |
| Medium protective box | 10 × 8 × 4 | 5 | 25 | 5 |
| Large protective box | 12 × 10 × 4 | 8 | 50 | 10 |

These are editable supply suggestions, not measured or carrier-verified specifications. Sleeve/top-load/team-bag raw cards with rigid cardboard protection; sleeve/cushion slabs in a snug box. Separate raw cards from slabs and fill empty space. Check the actual packed dimensions and weight before dispatch and adjust presets to the supplies used.

With automatic sizing on, choose the smallest configured volume that accommodates the load. Mixed loads share capacity: rawCount/rawCapacity + slabCount/slabCapacity must be at most 1; zero capacity excludes that item kind. Thus two raw cards plus one slab fit the small box and quote at 8 oz (2 + 3 + 3 packaging). Six raw cards plus one slab move to the medium box at 14 oz. Nothing is silently split into multiple labels; over-capacity loads require split requests or manual review. Existing insurance/value checks remain in force.

Quote records store the chosen package name/counts and exact parcel sent to Shippo. Shippo still determines the carrier rate using destination/origin and those measurements. A setup change invalidates unpaid old quotes through configuration versioning; paid requests retain their already-approved rate/parcel. Legacy raw/graded profiles continue working when automatic sizing is off. Sandbox labels use the same selection helper for one sample raw card.

For the current test-key-only stage, deploy ripprAccount and ripprShippoTest after pulling. When live shipping is connected later, deploy ripprLiveShipping (and ripprShipping only if using the test storefront) to apply the automatic quote logic there as well. No secret or Rules change is needed for packaging presets.

## Diagnosing sandbox errors

A Firebase callable HTTP 503 alone does not establish that Shippo returned 503: the adapter uses callable unavailable for provider errors. Updated sandbox UI reports the actual Shippo HTTP status, operation and whitelisted field names. 401 indicates rejected credentials, 403 denied account access, 429 rate limiting, and provider 5xx temporary unavailability. 400/422 require checking shipment/carrier inputs; raw response values are never returned. API keys, addresses and arbitrary provider body/detail messages are excluded. Label-server failures remain uncertain, never automatically retried.

After pulling diagnostic changes, deploy functions:ripprShippoTest for the current test-only setup and refresh the frontend. Repeat the sandbox check and share only the displayed status/step/field names. Actual connectivity still requires owner-run verification.

If HTTP 400 has no recognized invalid-field names, use the owner-only Cloud Shell quote diagnostic without another Functions deployment:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
node scripts/check-shippo.mjs rippr-2b01c
```

This reads the current live shipping setup and SHIPPO_TEST_API_KEY through the signed-in Cloud Shell account, requests one sender-to-distinct-destination test shipment quote, and prints bounded validation text with the token, OAuth access token, submitted address identity values, emails and recognizable keys removed. It never requests a transaction/label, writes Firestore, or debits site credit. API access itself is not verified by repository tests. The owner must run it to reveal their account's real rejection reason. Share only the resulting diagnostic output.


## Sandbox destination requirement

Shippo rejects identical origin/destination addresses. Enter a different valid contiguous-US destination in the private **Sandbox destination** fields in Admin → Shipping requests → Shippo setup, then save. This address is used only for owner sandbox quotes/test labels, not customer shipments or live dispatch. Keep the real ship-from address unchanged and both shipping enable switches off during testing. Changing only the recipient name is not sufficient; the test blocks an identical normalized street/unit/city/state/ZIP before any API request.

Deploy both ripprAccount (to save the new optional private fields) and ripprShippoTest (to use them). Refresh the deployed frontend, enter/save the separate test recipient/address and run the sandbox test. The Cloud Shell diagnostic now uses that same saved destination and redacts both addresses from provider validation text. Existing setup without a test destination remains valid for live customer shipments, but the owner sandbox test requires one. No API key change is needed for the identical-address error.

## Rates returned, test label ERROR

Returning rates confirms the shipment quote step worked, but does not establish successful label creation. The owner sandbox response now preserves bounded redacted carrier messages in label.errorSummary and displays them as “Carrier details” in admin. Messages are restricted to the owner-only test endpoint, with submitted sender/destination identity values and recognizable keys/emails removed. Failed labels never expose a printable URL or trigger an automatic retry. Deploy ripprShippoTest and refresh the frontend to read the next returned carrier reason. Alternatively inspect the failed test transaction in Shippo. Do not infer billing, carrier activation or address causes from ERROR alone.

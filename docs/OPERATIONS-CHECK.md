# Email, access and mobile operational review

Reviewed November 13, 2026, from commit a3c5b20 plus this report. No payments, email messages, SMS, deployments or customer-data changes were initiated.

## Owner decisions and evidence

- Collect applicable tax at funding. This is the owner’s intended treatment; no tax code, registration or Automatic Tax setting was changed. Guarded Checkout support is already implemented. Confirm the classification/code and sandbox tax calculation before enabling it.
- Current pack prices reported by the owner: $1, $5 and $15. Remote enabled packs, item stock, odds and saved prices were not read or changed in this review.
- Owner confirmed the confirmation email arrived and hello@rippr.gg can receive replies. Welcome, reward and support delivery are not inferred from that confirmation.
- Policy work is deferred until this operational work is complete; shipping integration remains deferred.

## Automated results

All checks below passed with locally fulfilled browser requests and isolated account/provider fixtures:

- Email templates and delivery: event routing, no pack receipts, confirmed-recipient and preference enforcement, deduplication, concurrent deliveries, stable provider idempotency, bounded retry, permanent errors, expiry, account-bound single-use confirmation and private terminal-payload cleanup.
- Phone/account service: authentication, identity binding, saved-price sales, double-sale prevention, cross-account denial and owner-only support/fulfillment actions.
- Email previews: nine preview templates at 390px and 1440px, embedded artwork, width/text controls and no overflow. Pack receipt remains preview-only.
- Email settings: confirmation request, provider-disabled error, token cleanup, single confirmation and no overflow at 320px, 390px and 1440px.
- Customer journeys: seven groups at each of 320px, 390px and 1440px. Includes signup referral timing, login Remember me and return destinations, unsafe-redirect rejection, inventory pagination, account-switch cleanup, museum ownership, tracking, owned seasonal packs and purchase/skip/interrupted-reveal continuity.
- Account settings and navigation: validation/failure recovery, preference rollback, phone-change focus, keyboard menu/Escape, popup validation/focus return, sign-out cleanup and no overflow at all three widths.
- Built-site reference check: 16 pages, 736 local references.

Totals: four domain test files and 32 browser groups. Browser checks use Chromium emulation, not physical iPhone/Android hardware. They do not send SMS or prove Firebase production authorization.

Repeat the focused suite with Chromium installed:

```bash
CHROMIUM_PATH=/usr/bin/chromium npm run test:operations
```

## Deployed evidence still needed

The workspace proxy rejected access to https://www.rippr.gg with HTTP 403 at CONNECT. This is an environment allowlist restriction, not evidence of a site outage. No provider/Firebase administrative credentials are configured here. The official rules emulator download was previously blocked; its tests are not claimed to pass.

1. On a dedicated test account, confirm the welcome email after confirmation; enable Email updates and claim one eligible reward; submit a test support ticket and send a staff reply. Verify actual inbox receipt and links. Opening a pack must not send a pack receipt.
2. Turn Email updates off and verify a subsequent reward sends no email. Change the email and verify confirmation is required again. Inspect provider delivery/bounce/suppression status without intentionally mailing an unrelated or invalid address. Confirmed delivery and provider accepted/sent are distinct states.
3. On the deployed build, test phone login/signup with a dedicated number, Remember me, signout/account switching, mobile menu, top-up cancellation/return, pack opening/skip and inventory. Check a real iPhone and Android plus desktop keyboard navigation. Do not use another customer’s account.
4. Run `npm run test:rules` where the official Firebase emulators can download, then deploy the reviewed rules. Local domain authorization tests do not substitute for deployed rules verification.

No new Function or rule deployment is required by this report or the combined test command. Existing pending backend changes still need their documented deployment. Step 6 is locally verified, with the above deployed/provider checks still open.

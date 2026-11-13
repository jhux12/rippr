# Owner-approved working policies

Owner approved these defaults November 13, 2026. They are proposed live-service rules awaiting legal review and enforcement, not permission to charge live payments or dispatch goods. All current balances/items remain sandbox. Operator: pullz.gg LLC, 320 N Meridian St, Ste 823 #122, Indianapolis, IN 46204, United States. Contact: hello@rippr.gg.

| Decision | Approved default | Implementation / remaining gate |
| --- | --- | --- |
| Eligibility | Adults 18+, US-only, cleared states only | Sandbox DOB/acknowledgment/version gates now exist (ELIGIBILITY.md). Live purchases stay disabled pending reviewed state allowlist, verified age/location and final-policy acceptance; no state is assumed cleared |
| Unused purchased credit | Request within 14 calendar days, original payment method, no refund fee | Future live wallet/refund workflow must reconcile unused purchased principal and applicable tax, prevent double recovery and preserve mandatory rights |
| Unopened purchased packs | Cancellation within 14 calendar days if unopened | Must atomically check unopened status, funding provenance and prior refunds; do not refund both a pack and the same credit |
| Opened packs | No outcome/duplicate/value-change refunds alone | Independently investigate unauthorized charges, incorrect odds, technical errors and missing awards; preserve mandatory remedies |
| Sellback | Nonwithdrawable site credit; clear confirmation; support corrects verified errors | Current sandbox sellback/ledger exists; production adapter remains unimplemented |
| Expiration | No expiration for purchased, sellback or promotional credit | Do not add expiry jobs; confirm mandatory unclaimed-property treatment with counsel |
| Transfers | No transfers or routine cash withdrawals | Preserve eligible original-payment refunds as a separate workflow |
| Closure | Support-assisted; resolve pending orders and eligible refunds; no inactivity confiscation | Reviewed sandbox request/cleanup tools now exist (ACCOUNT-CLOSURE.md); live refunds/closure still require review. Financial history/active cases are protected |
| Shipping | Initially contiguous US, tracked, actual quoted cost approved first | Keep disabled until stock/quotes/carrier and handling work; purchase eligibility remains separate |
| Dispatch | Target 3–5 business days after fulfillment activation | Staff coverage, delay notices and separate carrier transit estimates required; not a current guarantee |
| Wrong/damaged items | Request report within 14 days of delivery, photos where possible, appropriate replacement/refund; rippr pays reasonable return postage for its errors | Not an absolute legal cutoff; needs return authorization and stock/provider workflow |
| Lost shipments | rippr handles carrier investigation | Need carrier/insurance procedure; do not place all post-dispatch risk on customer |
| Condition | Raw Near Mint guide; slab image/company/grade match; support disputes | Badges and the intended Near Mint standard are described in Pack disclosures. Physical inventory checks and consistent condition assessment remain required |
| Deletion | Support intake; acknowledge within five business days; target 30 calendar days subject to law and verification | Sandbox phone-reverified request/admin redaction now exists. Provider/backups coverage and production/retention review remain pending |
| Retention | Necessary financial records seven years (accountant/legal confirmation); resolved support two years; security logs target 90 days | No automatic purge is created. Need record inventory, timestamp/legal hold logic, dry runs and provider retention review before deletion |
| Public profile | Remove promptly after verified deletion request | Need account closure/unpublish implementation; disclose backup/third-party copies |
| Marketing | Separate optional opt-ins; SMS off until provider/compliance setup | Existing separate preference storage, no marketing SMS sending |
| Effective date | Choose on final approval/publication; no backdating | Keep visible draft banners and noindex until final review; add versioned assent as required |

## Support intake playbook (current workflow)

Use the existing Contact support ticket or hello@rippr.gg; a new automatic refund/closure endpoint is not implied.

1. Verify the requester controls the account. Do not ask for OTPs, passwords, full card numbers or secret keys.
2. Record request type, account UID, order/payment/item references, relevant dates and requested remedy in the private ticket. Do not publish addresses or financial evidence in Community.
3. For payment issues, inspect canonical provider status and the immutable ledger. The current Admin → Payments only reconciles sandbox records; it does not issue provider refunds. Never label a manual credit adjustment a refund to the payment method.
4. For unopened packs or unused funds, check actual saved state and provenance; prevent opening/selling/refunding the same entitlement concurrently before any eventual production remedy. Escalate uncertain tax/partial refund allocation rather than taking unrelated promo/sellback credit.
5. For deletion/closure, acknowledge the request and identify active orders, disputes and required records. Do not purge account data blindly or promise that this draft already triggers erasure. Escalate to the owner for a verified, documented operation and final response within applicable deadlines.
6. For condition/delivery complaints, retain relevant photos and records privately and do not demand that the customer alone resolve carrier loss. Shipping remains a test flow, so no dispatch promises may be made now.

## Build order before live activation

1. Legal/model/state/processor clearance and final policy versions.
2. Separate production wallet and refund/closure reconciliation; preserve sandbox isolation.
3. Server-enforced eligibility and versioned acceptance at the actual purchase/signup decision.
4. Verified deletion/redaction/public-profile removal with audit retention/legal holds; validate on test accounts and backups/providers before production use.
5. Stock, shipping and return operations before offering physical delivery.
6. Review and activate final policies with an effective date only when the corresponding controls work.

No automatic customer-data deletion, live charging, tax collection or real shipment is enabled by approval of these defaults.

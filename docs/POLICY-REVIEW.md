# Policy draft review before live launch

Prepared November 13, 2026. These are website-ready review drafts, not a legal opinion, determination of the business model’s legality, or final terms. Their visible draft banners and noindex tags must remain until reviewed. No customer acceptance version, checkbox, age verification, region restriction or acceptance log is introduced by this batch.

## Pages

- `/terms` — accounts, packs, site credit, sellbacks, rewards and acceptable use.
- `/privacy` — Firebase authentication/storage, Vercel hosting, Stripe Checkout, Resend, public collections/profile images, browser persistence, preferences and retention gaps.
- `/refunds` — sandbox status, cancellation versus refunds, payment issues, unopened/opened packs, sellbacks, review holds and physical-item concerns.
- `/shipping-policy` — test requests, unavailable quotes, no dispatch/estimate promises, packaging concepts and unresolved delivery procedures.
- `/pack-disclosures` — one card per pack, site rarity, odds/value ranges, random duplicates, reference values, Near Mint/slab distinction and no affiliation/verified-review claims.

Shared footer links reach all five pages without requiring JavaScript or login. Legacy terms/privacy footer buttons route to these pages. The separate SMS prelaunch-consent dialog remains intact. Contact is the owner-confirmed monitored address hello@rippr.gg and the existing support page.

## Owner/counsel decisions to fill in

1. **Operator:** full legal entity or proprietor name, DBA if applicable, mailing/contact address, place of establishment and responsible privacy contact. Do not invent an LLC or put a private residential address in public code without an explicit decision.
2. **Eligibility and model:** adult-only proposed terms, launch states and excluded locations, appropriate verification and state-specific review of paid randomized card allocation, stored credit, promotions and sellback mechanics. Written Stripe acceptance for the actual model remains separate from legal review and API success.
3. **Credit:** production expiration/transferability, spending order, promotional eligibility, treatment on closure, unused purchased credit and mandatory refund/unclaimed-property rights. Test legacy/promo/sellback balances must not be converted into real purchased funds.
4. **Refunds:** unopened/unused credit treatment, opened-pack cancellation rights, incorrect/unauthorized payments, condition disputes, return window, return authorization/postage, original-payment refund method and provider timing. Avoid blanket statements that waive mandatory remedies.
5. **Fulfillment:** only after stock controls/carrier/quotes work, specify actual destinations, preparation/transit estimates, costs, insurance, lost/damaged/undeliverable procedures, address corrections, customs and returns. No new deadline/free-shipping promise is made now.
6. **Privacy:** confirm providers/data flows, contracts, security controls, public image behavior, retention/deletion schedule, support identity verification and rights-response process. Assess applicable state privacy/children/cookie requirements before finalizing; the draft does not promise a non-existent delete-account feature or assert a categorical tracking exemption.
7. **Tax:** owner explicitly chose to leave collection off pending classification/registration. No tax code or liability setting changed. Do not infer that tax being off removes a tax obligation.
8. **Marketing and promotions:** SMS remains off. Final provider/registration, fresh consent, STOP/HELP, frequency and privacy terms remain separate. Approve reward/referral terms before production and ensure displayed eligibility/odds match the backend.
9. **Legal clauses:** counsel decides any governing law, dispute procedure, suspension/termination rules and permissible liability language. Drafts intentionally do not invent arbitration, a class-action waiver or broad disclaimers of consumer rights.
10. **Publication:** choose the effective/version date, remove review notes only after approval, publish final pages, and implement any required pre-purchase/signup assent and retained acceptance records. Recheck disclosures at the actual purchase decision, not just the footer. An accessible policy page alone does not implement contractual assent.

## Current verification evidence

Owner reported successful Checkout success/cancellation and refund testing, and later confirmed welcome/reward/support/opt-out email checks. These are owner reports, not independently observed provider logs. Local automated operational checks remain documented in OPERATIONS-CHECK.md. Live charging, real-money wallet adaptation, stock fulfillment and final legal/tax clearance remain incomplete.

## Review command

```bash
npm run build
npm run check:site
CHROMIUM_PATH=/usr/bin/chromium npm run test:policies:browser
```

No new Firebase Function, rule, secret, tax setting, provider call or live payment change is part of this draft batch. Normal frontend deployment publishes the marked drafts; it does not launch real-money service.

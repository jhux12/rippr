# Admin operations overview

Admin → Overview provides a read-only operational checklist while retaining Packs as the existing default screen.

- **Payment holds:** all `testAccounts` with `paymentHold: true`, plus a separate count of open payment-review queue cases. Resolving a review may leave a debt hold, so these are deliberately separate metrics. The button opens Payments.
- **Email delivery:** failed/expired outbox jobs, retry jobs, and pending/processing jobs. These are all retained outbox records, not delivery receipts. Sent does not prove inbox delivery. The link opens Resend logs in a new tab; no resend or provider API action is performed.
- **Shipping requests:** all received (`test-request`), review and packing records in the existing shipping queue. Shipped, delivered and canceled requests are excluded. The button opens Shipping requests; it does not create a quote, label or dispatch.
- **Promotion estimate:** seven Indianapolis calendar days of recorded gross reward value, using the existing award-time pack EV and credit-face-value totals. Older untracked rewards remain excluded. This is not net cash profit or refund accounting. The button opens Spark rewards and its detailed promotion summary.

Queue totals use Firestore server aggregation over the complete retained collections rather than downloading/estimating from the first management page. All queue filters use their single status field, or `paymentHold` on root accounts, so no composite indexes are introduced. The response contains counts and promotion period/value only: no recipients, addresses, customer UIDs, payment payloads or raw provider errors.

`adminOverview` requires the verified owner token. Each section loads independently; a failed source displays Unavailable rather than 0, while working sections remain useful. Explicit refresh avoids background polling costs. Whole-request failures retain prior results with a warning. Account switches and sign-out clear the data and invalidate in-flight responses. A refresh timestamp makes the snapshot's freshness visible; it is not an atomic cross-queue snapshot.

No new secrets, rules, indexes, provider integrations or messaging actions. Existing management screens remain responsible for resolving records.

Deployment:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy --only functions:ripprAccount --project rippr-2b01c
```

Frontend uses the normal Vercel build. Domain checks cover owner authorization, 205 matching records (beyond management-page limits), final-state exclusions, privacy and partial failure. Chromium fixtures cover 320/390/1440px layout, queue navigation, external logs link, refresh/recovery and stale-response cleanup on sign-out. Firebase emulator/provider configuration is a separate check.

# Transactional email setup

The eight account emails are wired to saved server events. **Pack receipts are never queued or delivered.** The HTML receipt remains a preview asset only.

The implementation includes a Resend HTTPS adapter, four new Firebase Functions, a private `emailOutbox`, confirmation links, retry/idempotency handling and account preference checks. Sending defaults to **off**. No email provider, sender domain, secret or production delivery has been configured by the code change. You can select another provider by replacing the isolated `sendResend` transport in `functions/email-delivery.js`.

## What sends

| Template | Trigger | Preference |
| --- | --- | --- |
| Welcome | First confirmed account email; once per account | Confirmation required |
| Shipping request | New saved shipping request | Shipping updates |
| Order shipped / delivered | Change into the corresponding saved shipping status | Shipping updates |
| Reward earned | Committed daily spin, streak or welcome-case award activity | Email updates |
| Referral earned | Committed referral-credit activity, for either credited participant | Email updates |
| Support received | New saved support ticket | Confirmation required |
| Support reply | New saved staff message; status-only changes and customer messages do not send | Confirmation required |

Phone-only accounts are supported. In **Profile → Account settings**, save an email address, click **Confirm email**, and open the confirmation link while signed into the same rippr account. A welcome email follows the first successful confirmation, rather than phone signup with no email. Existing addresses do not count as confirmed. No historical reward/shipping/support events are replayed when email is first enabled. Support notifications use the account’s confirmed address; the free-text address on a ticket is not a verified recipient. Email updates defaults off; shipping updates defaults on. Neither preference affects phone sign-in.

## Enable with Resend

1. Create a Resend account and verify a sending domain you control using its DNS instructions. Choose a sender email and a monitored reply-to email. The sender display name is automatically “rippr”. SPF/DKIM and DMARC should be configured for the domain. Never use the Resend test domain for production recipients.
2. In Cloud Shell, from the latest checkout:

   ```bash
   cd ~/rippr &&
   git pull --ff-only origin main &&
   npm ci &&
   npm ci --prefix functions &&
   npx firebase functions:secrets:set RESEND_API_KEY --project rippr-2b01c
   ```

   Paste the provider key **only into the CLI’s secret prompt**, not chat, source files or `.env`. If Git reports local changes, stop rather than overwriting them.
3. Add/update these non-secret parameters in `functions/.env.rippr-2b01c`, preserving existing values such as `FREE_TEST_TOPUPS`. Replace the example origin and addresses with your real verified values. Start with `EMAIL_ENABLED=false` until you are ready to test delivery:

   ```dotenv
   EMAIL_ENABLED=false
   EMAIL_SITE_URL=https://your-domain.com
   EMAIL_FROM=hello@your-domain.com
   EMAIL_REPLY_TO=support@your-domain.com
   ```

4. Deploy the account actions, event handlers, delivery worker, scheduled retry and rules:

   ```bash
   npx firebase deploy \
     --only functions:ripprAccount,functions:ripprEmailEvents,functions:ripprEmailWelcome,functions:ripprEmailDelivery,functions:ripprEmailRetry,firestore:rules \
     --project rippr-2b01c
   ```

   Firebase must be on Blaze with Eventarc, Cloud Run and Cloud Scheduler available. The CLI normally provisions required APIs. Scheduler may have billing implications. No `ripprMuseum` redeploy is required by this feature. No composite index or package install beyond existing dependencies is required.
5. Deploy the frontend through the normal GitHub/Vercel workflow. Once sender DNS is verified, change `EMAIL_ENABLED=true` and redeploy **all five Functions named above**, so every handler has the same setting. Then confirm your own email from Account settings. Verify both confirmation and welcome messages in an actual inbox.
6. Enable Email updates on that test account, claim one reward, submit a support request and send a staff reply. Check shipping status events only with test requests; this does not initiate real shipping or payment. Confirm no pack receipt arrives after opening packs. Then test turning preferences off and changing the saved email (which requires reconfirmation).

## Reliability and privacy

- Event handlers read saved documents after successful transactions, not browser assertions. Event IDs deterministically identify each outbox message. Welcome and shipped/delivered notices send once per account/order phase.
- Only server-confirmed email addresses receive account content. Addresses/preferences are checked again at delivery time. Changing the address cancels old queued messages. Verification links expire in 30 minutes, are account-bound and single-use; a new request replaces the old link. Limit: one confirmation request per minute, five per UTC day.
- `emailOutbox` is inaccessible to all browser clients, including admin. Pending payloads are private server data. Terminal jobs discard recipient/content/token payloads and retain status, timestamps and provider ID. Confirmation tokens are hashed in account metadata; account operation logs retain only the token hash.
- Provider sends happen outside Firestore transactions. A delivery lease prevents concurrent sends. Every retry reuses the same provider idempotency key and frozen payload. Up to five attempts; retries use backoff, and a scheduled sweep picks up due jobs/expired leases. Jobs expire after 23 hours, within Resend’s 24-hour idempotency window. Exhausted/permanent failures are terminal. Do not manually reset terminal job IDs; create a new legitimate account event instead.
- Sender/config validation fails closed. `EMAIL_ENABLED=false` stops new event jobs and delivery; pending jobs age out when enabled. Unsent events while disabled do not cause a later historical blast. Confirmation requests report that delivery is not configured while disabled.
- The Resend account’s suppression/bounce handling remains in effect. Review its delivery dashboard for bounces/complaints. This implementation does not add a bounce webhook or marketing campaigns. In-app settings govern reward/shipping emails; support/account confirmation messages remain transactional.
- `testAccounts` still represents test credit/items. This feature does not turn it into a real-money wallet or fulfillment system. No shipment is created or charged by sending an email.

## Inspect issues

In Firebase Console, inspect `emailOutbox` statuses: `pending`, `processing`, `retry`, `sent`, `skipped`, `expired`, `failed`. Reasons are coarse and contain no provider response body or token. `recipient-or-preference` indicates an unconfirmed/changed address or disabled notification preference. `provider-rejected` normally needs sender/domain/credential correction; the Resend dashboard gives the actual provider error. `provider-unavailable` retries. `invalid-template-data` is terminal and needs event-data correction.

Use Cloud Logging for the `ripprEmail*` Functions. Do not paste verification links, API keys, full recipient addresses or message payloads into public logs/issues. A successful unit/browser suite uses mocked delivery and is not proof of real inbox placement; check Gmail/Outlook/iOS Mail with the actual verified sender before broad rollout.

## Local checks

```bash
npm run test:emails
CHROMIUM_PATH=/usr/bin/chromium npm run test:emails:browser
npm run test:rules
```

The rules suite includes explicit email-outbox client denials. It requires the official Firestore/Storage emulators; the managed environment may block their download from `storage.googleapis.com`. No tests contact Resend or send live mail.

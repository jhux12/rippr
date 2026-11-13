# Text-alert preferences (prelaunch)

Account settings → Preferences → Text alerts provides a separate optional checkbox and explicit Save button. It is unchecked for new/existing users. Phone login, email preferences, rewards, and purchases never opt anyone in. No sign-up/login changes were made.

This records a **prelaunch preference**, not authorization to start live campaigns under unfinished terms. The disclosure is `rippr-text-alerts-prelaunch-v1`; it names rippr, new-release/restock promotional messages, automated recurring texts, up to four per month, possible carrier charges, optional consent not required for purchase, future STOP/HELP instructions and the in-account off control. The section clearly says no text alerts are sending. Terms/Privacy buttons open the existing site policy dialogs; those are still placeholders maintained by the owner.

## Records

The authenticated `smsConsent` account action validates the submitted version and binds opt-in to the Firebase token’s verified `phone_number`. A browser-supplied expected phone must match. Clients cannot choose audit timestamps, disclosure text, source or phone binding. The exact server disclosure, version, verified number, revision and server time are stored in `testAccounts/{uid}.smsConsent`, with immutable event records in `testAccounts/{uid}/smsConsentEvents/{operationId}`. Transactional operation IDs prevent duplicate audit writes on retries. Existing Firestore rules keep the account/history private to its owner and prohibit all browser writes.

An opt-out is available without a linked phone or current disclosure version, including after a phone change. Previous consent does not apply to a different phone number or newer disclosure version. The current UI clears pending/active choices when the verified phone changes, and the server separately rejects stale opt-in numbers. An eventual sending adapter must read the **current Firebase Auth phone number**, not just the stored consent number, before each send.

## Sending remains off

`SMS_PROGRAM_READY` is hardcoded false in the shared `sms-consent-model.js`, and `canSendMarketingSms` therefore always returns false. There is no marketing SMS provider, outbound send action, scheduled campaign, sender registration, or STOP/HELP receiver. Resend only handles email; Firebase continues to handle login verification SMS separately.

Before live campaigns, the owner supplies final SMS terms/privacy and selects/registers the messaging provider. Publish a new disclosure version and obtain fresh consent before sending. Integrate inbound STOP/HELP, provider-level suppression and delivery handling, enforce the advertised frequency, and preserve withdrawal events without enrolling anyone automatically. Do not remove the readiness gate or bulk-import prelaunch preferences as live opt-ins.

## Deploy and verify

Deploy the frontend through the normal GitHub/Vercel workflow, then the updated account action:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy --only functions:ripprAccount --project rippr-2b01c
```

No new Firebase Function, secret, provider charge, index, or rules update is needed for this feature. The rules regression includes client-forged consent/history denial; official emulator execution may remain blocked by the environment’s download restrictions.

Tests: `npm run test:sms-consent`; `CHROMIUM_PATH=/usr/bin/chromium npm run test:sms-consent:browser`. Browser fixtures cover default-off state, explicit save, failures, masked phone display, phone changes, opt-out, policy dialog and mobile/desktop layout. Domain tests cover signed-phone binding, spoofed metadata, stale disclosure, immutable audit records, idempotency, withdrawal after phone removal/change and the closed sending gate. No tests send a text.

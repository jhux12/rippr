# Owner live promotional credit

Admin → Payments → Add live promotional credit adds a ledger-backed promotional balance to the signed-in verified owner’s own live account. It cannot target customers. This supports owner testing without editing Firestore or switching storefront modes.

Deploy the backend after pulling the current repository:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npx firebase deploy --only functions:ripprAccount --project rippr-2b01c
```

Frontend deployment must also include the new admin form/script. No new secrets, Rules changes or live-mode configuration changes are required. Refresh admin after both deployments.

Enter $1–$100 and a reason of 10–500 characters. Confirm the explicit live-credit prompt. The cap is $500 per UTC calendar day. The tool requires the existing verified owner token identity, an open live wallet with consistent buckets, and no payment hold/debt/open reviews. Fix a damaged wallet first; this tool does not reconcile manual edits.

The grant credits promotionalCents, records an operation, credit ledger entry, private owner audit note and account activity, and updates the wallet atomically. Retrying the same operation returns the original result without another credit, including after hitting the daily cap. On unconfirmed browser responses, amount/reason remain locked for the safe same-request retry. Account changes clear the form and hide owner controls.

It does not create a Stripe payment, deposit timestamps, welcome eligibility, referral spend or Spark Points. Existing reward eligibility is unchanged. Promotional spending follows the existing credit priority. Packs opened on the live site award real inventory; sellback and shipping keep their normal live behavior. No promotional credit was added to a production account by this implementation.

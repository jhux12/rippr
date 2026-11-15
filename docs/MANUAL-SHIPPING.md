# Weight-based checkout shipping — no shipping API

Customers see your configured shipping price based on packed weight, pay from site credit, and you buy labels separately. Existing Stripe top-ups can fund that balance. This does not add a separate Stripe checkout for shipping.

## Deploy

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npx firebase deploy --only functions:ripprAccount --project rippr-2b01c
```

The frontend must also finish its normal deployment. No Shippo token, new secret or Rules update is required for this mode.

## Configure

1. Admin → Shipping requests → Shipping setup.
2. Select **Weight-based prices · no shipping API**.
3. Enter USD prices for the weight brackets you want. The form starts with up to 4, 8, 16, 32 and 64 oz. Empty prices are skipped; no production prices were invented or activated by this change.
4. Use/review the suggested packing presets: 1 oz per raw card, 3 oz per slab, plus packaging tare. Weights and dimensions remain editable.
5. Enable shipping prices and Accept shipping payments, then Save shipping setup.

New unsaved setups default to weight-based mode with prices/payments off. Existing Shippo setups keep their mode until the owner changes it. Weight limits must increase, prices must be positive cents, and parcels above the last priced bracket require a manual quote. Origin/carrier setup is not required for local pricing. Existing destination-country and manual insurance/value limits still apply.

## Operation

The shipping dialog calculates the total packed weight using authoritative owned inventory, selects the first matching bracket and shows the merchant's shipping price. This is not a live carrier quote. No items or credit change during preview. The customer approves payment from balance inside the popup. A private short-lived quote is saved first; only successful payment atomically creates a paid shipment, queue entry and item reservation. Closing before payment changes no items or credit; the customer can calculate fresh prices later. Credits use the normal source-priority ledger, with no Spark Points or referral spend. The carrier markup controls do not apply to manual prices. A changed table invalidates unpaid quotes; existing paid requests retain their approved charge.

Buy a tracked label in your chosen shipping service, then enter the carrier/tracking and mark shipped in admin after handoff. Automatic label purchase/provider tracking sync are disabled for this mode, including direct access through a carrier endpoint. Official carrier tracking links still work; update statuses manually. Owner shipping-credit refunds remain available for eligible unshipped requests; verify any separately purchased postage before canceling/refunding.

Only basic address completeness/format checks happen locally. No carrier address verification or suggestions are claimed, and saved defaults are not silently changed. The optional Shippo mode remains available separately. Account service routing selects the saved mode on the server, never from client prices; customer financial actions retain eligibility, closure, debt and review guards.

# rippr transactional email set

Nine provider-neutral templates: welcome, pack receipt, shipping request received, order shipped, order delivered, reward earned, referral earned, support request received, and support reply. Every render returns `subject`, `preheader`, `html`, and `text`.

## Preview

Run `npm run build:emails`, then open `emails/output/preview.html` in a browser. Switch templates, desktop/mobile width or plain text, and download individual files. Preview uses embedded existing Pip art and fictional sample data. No emails are sent. The output HTML files use the configured absolute site origin for images and links; their default is deliberately `https://rippr.example`, not a live destination. Do not send these samples unchanged.

To build samples using your actual public origin:

```bash
RIPPR_EMAIL_SITE_URL=https://your-domain.com npm run build:emails
```

The runtime renderer always requires a public HTTPS origin. Existing PNG Pip images must be reachable at `/assets/mascot/pip-welcome.png` and `/assets/mascot/pip-celebrate.png`. Images are decorative and optional; key information is live text. Email clients may block images, change dark-mode colors, or ignore rounded corners; test inbox rendering before enabling sending. Tables, inline core styles, system fonts and a plain-text alternative provide the fallback.

## Render with real server-confirmed data

```js
import {renderEmail} from './emails/templates.mjs';
const email = renderEmail('pack-receipt', {
  displayName: account.handle,
  reference: opening.id,
  packName: opening.packName,
  totalCents: opening.totalCents,
  items: opening.cards.map(card => ({name:card.name, rarity:card.rarity}))
}, {siteUrl: 'https://your-domain.com'});
// Your provider receives recipient plus email.subject, email.html and email.text.
```

Only pass final server records. Never send from client-reported purchase, prize or shipping status. Monetary values use integer US cents. Rendered data is escaped; tracking URLs require HTTPS. Missing reward/reply/receipt content or invalid money throws rather than producing a misleading message. Buttons use existing profile, rewards, order-tracking and support pages. They lead to the page list, not a specific record; users may need to sign in. No unimplemented deep links are invented.

| Template | Event / inputs beyond `displayName` |
| --- | --- |
| `welcome` | Newly created account, once |
| `pack-receipt` | Completed opening: `reference`, `packName`, `totalCents`, `items` (`name`, `rarity`) |
| `shipping-request` | Saved request: `reference`, `itemCount`, optional `shippingCents` estimate |
| `order-shipped` | Confirmed shipped status: `reference`, `carrier`, `trackingNumber`, optional trusted `trackingUrl`, optional `estimatedDelivery` |
| `order-delivered` | Confirmed delivered status: `reference` |
| `reward-earned` | Committed award: `rewardName`, `rewardSource` |
| `referral-earned` | Committed referral credit: `amountCents` |
| `support-received` | Saved ticket: `reference`, `topic` |
| `support-reply` | Saved staff reply: `reference`, `message` |

## Sending integration remains separate

No provider, SMTP credential, sender address, domain or automation is configured by this change. No production messages or Firebase changes are triggered. Phone-only users may not have an email address; do not require one to use rippr or invent recipients. Connect a provider only after confirming a recipient's email and appropriate account preferences; `emailForUpdates` currently stores an address but does not verify ownership.

When connecting sending: authenticate the sender domain (SPF, DKIM and DMARC), use a monitored reply-to address, deduplicate by event ID and message type, log provider delivery results, retry transient failures, and honor bounces/suppressions. These templates describe account activity, not promotions. Reward reminders or marketing campaigns need separate opt-in, unsubscribe/preference handling and the business’s required footer/address. No fabricated ratings, delivery promises, urgency or odds appear in these emails.

# Mobile customer journey review

Reviewed on November 14, 2026 using isolated Chromium fixtures at 320px, 390px and 1440px. The page scripts and account-domain service run locally; browser fixtures do not send SMS, contact production Firebase, or create real payments. The owner separately reported successful live funding, refund, purchase, sellback and public-access checks.

## Journey covered

- Login/signup: separate modes, referral validation before SMS, Remember me choice, verification, safe return to the prior page and rejection of external redirects.
- Top-up: test/live copy, hosted Checkout redirect, validation errors, paused funding, small-height dialog scrolling, pending confirmation, success and canceled pages. Visiting a return URL cannot mint credit.
- Opening: one debit per batch, skip across multiple selected packs, fullscreen exit continuity and persisted awards when leaving before reveal. Disabled catalog sales stay blocked; already-earned reward packs remain usable once.
- Inventory: older items/packs load through pagination, individual/bulk sellback use stored values, selections survive refresh, account changes clear another user's inventory and dialogs.
- Navigation: keyboard menu access, Escape, dialog focus return, invalid-amount focus and removal of the balance control on sign-out.

## Changes

Several secondary auth controls and inventory actions were 32–40px high. Mobile auth code actions, invite continuation, login/signup switch, inventory filters, search/select controls, account links and sell/ship controls now have at least 44px-high touch targets. Icon/filter controls also reserve at least 44px width. Inventory search now uses 16px text to avoid the common iOS focus-zoom trigger. Copy, pack prices, odds, account behavior and live-mode settings are unchanged.

The journey regression now checks the relevant rendered tap targets, horizontal overflow and mobile search input size, so competing stylesheet rules cannot silently shrink those controls again.

## Verification limits

Chromium fixtures cannot prove actual iPhone Safari keyboard, SMS autofill, cellular latency or payment-provider behavior. A real iPhone check should cover entering a phone number/code, opening inventory search, and dismissing the top-up modal while the keyboard is visible. No financial backend or Firebase Rules changes are required for these layout adjustments.

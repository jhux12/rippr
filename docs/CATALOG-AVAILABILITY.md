# Saved catalogs required for openings and reward packs

All new server purchases and owned-pack openings require an existing, valid saved `packContents/{id}` document. Missing standard tiers no longer fall back to illustrative cards. Invalid catalogs remain rejected before debit, award, inventory-pack consumption or successful operation recording.

All positive-probability pack prizes must also have valid saved catalogs before enabling reward settings or awarding rewards. A missing reachable prize pauses the whole claim without rerolling, consuming cooldown or creating a pack. Zero-chance unavailable prizes and paused reward settings retain their existing behavior.

An already-owned pack remains intact if its catalog is missing/invalid. Once restored, it can be opened normally. Ending sales alone does not revoke owned packs: a valid saved but disabled catalog can still serve an existing owned entitlement without another balance charge. Historical successful operation retries still return their saved outcome; this change does not revoke cards or undo earlier records.

## Frontend and admin

Customer catalog reads reject missing documents; the opening page disables its action and reports the pack as unavailable. Invalid/missing catalogs do not show fallback grails or start an opening. Network failures retain the existing retry/reload message.

Admin explicitly requests `forEditor:true` when loading editor drafts. A missing document produces a version-zero **disabled draft**, retaining the existing catalog-creation workflow. Loading/editing a draft never publishes or writes anything. Saved demo catalogs are not automatically removed by this change: keep the unready Elite, Ultimate and Icy Rush pools disabled and replace their demo entries before issuing them. A structurally valid saved demo pool is distinct from the removed missing-document fallback.

No saved pack price, odds, card pool, enabled flag, customer balance or item was changed here. Basic $1, Plus $5 and Premium $10 remain as saved by the owner. Existing configured catalogs and public display price calculations are unchanged. Physical stock reservation remains a separate pre-live task.

## Deployment

Deploy frontend via the normal Vercel flow, then update the existing account Function:

```bash
cd ~/rippr &&
git pull --ff-only origin main &&
npm ci &&
npm ci --prefix functions &&
npx firebase deploy --only functions:ripprAccount --project rippr-2b01c
```

No rule, secret, index or new Function. Do not delete/modify a production pack to test this change; use dedicated test fixtures or a separate sandbox setup. Previously configured reward pools should continue if all their reachable pack catalogs remain saved and valid.

## Validation

- All seven tier IDs are tested with absent catalogs for direct purchases and owned opening: no debit, card award, consumed entitlement or recorded success.
- Invalid/restored/disabled catalog transitions preserve ownership and exactly-once redemption.
- Missing reward catalogs prevent saving active prize configurations and claiming prizes, without consuming a cooldown or operation ID.
- Existing domain fixtures now persist explicit version-one test catalogs rather than implicitly relying on absent server data. The fixture helper is test-only and never creates site catalogs.
- Missing/invalid opening UI is exercised at 320/390/1440px with no account mutation; customer journeys and rewards-wheel browser regressions pass at all three widths.

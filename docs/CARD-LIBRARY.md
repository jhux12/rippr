# Card library

Open `/admin` with the verified owner account and choose **Card library**.
This is a separate reusable catalog. Saving it does not publish or reprice packs.

## Import Pokémon cards

1. Choose **Import Pokémon**. Search by card name (at least two letters), set ID, or both. For example, `Umbreon` and `swsh7`.
2. Select up to 50 cards across search pages, then **Preview selected imports**.
3. Review the name, set, number, artwork and listed TCGplayer USD market value. Set **Site rarity** on each card, or choose a rarity above the preview and **Apply to all imports**, then adjust individual cards. Existing library IDs are skipped. Choose the correct finish if multiple prices are available.
4. **Save to library** stores cards without assigning them to any pack. You can also edit rarities later in Saved cards. Cards without a listed price stay unpriced; you can enter their values manually. Printed source rarity is not silently mapped to a site prize tier.
5. Review the physical finish in **Edit** before pricing. TCGdex supplies card-level artwork, which does not identify which physical foil variant you intend to stock. Use a separate CSV ID for a reverse holo, other finish, or graded slab.

English TCGdex imports use stable IDs such as `tdx-en-swsh7-215`. Search is paginated (24 results); detail requests run four at a time and have a 15-second timeout. Recent responses are cached in memory. Missing artwork or malformed details produce an error rather than invented card data. No API key is required by this public endpoint.

The adapter follows the official [TCGdex JavaScript SDK](https://github.com/tcgdex/javascript-sdk) query and card schemas. The [database README](https://github.com/tcgdex/cards-database) and [MIT license](https://github.com/tcgdex/cards-database/blob/master/LICENSE) were accessible during implementation. Direct `api.tcgdex.net` access is denied by this workspace's network policy, so current live search availability, CORS, artwork coverage and image delivery have **not** been verified here. Browser tests use intercepted documented responses. If a deployed browser cannot reach TCGdex, the page shows an error and CSV remains available.

## TCGplayer market values

The owner approved using **listed TCGplayer USD market values through TCGdex**. The raw-card Near Mint badge remains the owner's condition policy; the feed is not represented as verified Near Mint-only pricing. Graded slabs keep separate owner-entered values.

New Pokémon import previews fetch listed market values automatically. A standard/non-foil quote is selected when available; otherwise a single unambiguous finish can be selected automatically. Multiple other finishes require a choice. You can choose **Import without value** and enter a manual price later. Existing IDs are skipped rather than overwritten during imports.

To update saved cards:

1. Select up to 50 library cards and click **Get TCGplayer prices**.
2. Review the matched card/set/number, current value, finish choices and source update time.
3. An exact finish match is selected when available. For an unmatched finish, choose its quote explicitly or leave **Keep current value**.
4. Click **Save to library**. Only selected price changes are saved; pack snapshots and past winnings remain unchanged.

For an existing manually entered or copied card, **Edit → TCGdex card ID** links it to the exact provider card, for example `swsh7-215`. Find the ID in the Pokémon search results. The price preview shows the matched identity so you can check the link before accepting a value. Slabs are excluded even if linked.

The adapter uses `pricing.tcgplayer` from the official [market-pricing guide](https://github.com/tcgdex/documentation/blob/master/src/content/docs/markets-prices.mdx) and [card schema](https://github.com/tcgdex/documentation/blob/master/src/content/docs/reference/card.mdx). It uses `marketPrice` for the chosen finish, requires USD and a valid update timestamp, and rounds to cents. It does not substitute a low/mid/high quote, EUR value, zero, another finish, or a slab estimate. Missing, zero, malformed or unavailable quotes leave existing values unchanged. Update times over seven days old are flagged in the preview. Each price request bypasses the in-memory response cache, with up to four concurrent requests and the same timeout as card imports.

The provider's [FAQ](https://github.com/tcgdex/documentation/blob/master/src/content/docs/faq.mdx) records printing/listing mapping issues, so the preview explicitly asks the owner to review the matched printing and finish. TCGdex does not document the condition for these market references; `normal` means non-foil, not Near Mint. No certification of price accuracy or direct TCGplayer connection is claimed.

This feature adds no Function, rule change, secret or API key beyond the already implemented library. Prices are refreshed on demand, not by a scheduled job. The source timestamp is displayed during review; saved values use the library's existing revision/update metadata. Live API/CORS verification remains subject to the network limitation above.

## Import and update CSV values

Use **CSV import → Download CSV template**, or select saved cards and **Export selected CSV**. Import up to 500 rows / 2 MB at a time. Supported headers:

```csv
id,name,setName,number,finish,image,rarity,value,gradingCompany,grade,referenceURL
```

- `id` is required. A new card also needs `name` and a valid image URL/site asset path.
- To update prices, an `id,value` CSV is enough. Values are USD (`2.50`), never cents, and require at most two decimal places. Blank cells keep existing fields. Zero is a valid explicit value; blank new values stay unpriced.
- Use **Update supplied fields** to edit existing IDs or **Skip existing cards** to leave them alone. Duplicate IDs within a file and invalid rows block saving until corrected. Existing image, finish, grade and source metadata are retained on partial updates.
- Slabs require both `gradingCompany` and `grade`. Supported companies/grades match the pack editor. Use a distinct ID such as `umbreon-swsh7-215-psa10` and the slab photo. A raw and PSA-10 copy are separate records with separate values.
- Optional `referenceURL` accepts HTTPS TCGplayer links. It is a reference only. Market values are fetched separately through TCGdex; the link itself is not scraped. No TCGplayer credential or purchase integration is included.
- CSV quoting supports commas, embedded newlines, doubled quotes, UTF-8 BOM and CRLF. Exports escape spreadsheet formula prefixes. If you export a card name starting with a formula prefix, remove the protective apostrophe only when intentionally editing that name; a price-only import avoids changing it.

Every import has a preview. Saving uses atomic batches of at most 50 cards and checks each card's revision. If batch two fails after batch one succeeds, only unsaved rows remain in the preview. Retry saves those remaining rows. A revision conflict requires discarding/rebuilding the preview from refreshed records; it never silently overwrites another session.

## Reuse cards in packs

**Copy pack cards** previews the loaded pack drafts in the library and skips existing library IDs. No automatic migration runs.

Open **Packs**, choose a tier, then **Browse site cards**. This picker selects from the saved site library; the library no longer has a separate pack-assignment form.

- Search by card name, set, number, finish or ID. Filter by site rarity, raw/graded condition and inclusive minimum/maximum USD value.
- Sort by **Recently added**, value low/high or name. Hide cards already in the pack, or show selected cards only. Selections survive filter changes.
- Cards without a value or site rarity are visible but cannot be selected. Cards already in the pack are marked and cannot be selected again. The pack limit remains 100 cards.
- **Add selected to draft** fetches current saved records. If a selected card changed, its values/rarity are refreshed for review before adding again. Newly added cards start at 0% odds; existing cards retain their values, odds and grail flags. Slab grading is preserved.
- Use the pack EV calculator (include zero-odds cards explicitly) or set odds yourself, then **Save changes** to publish. Closing the picker discards its unadded selection.

The picker loads the complete owner-only library in 200-record batches, displaying progress and 30 tiles at a time. Filters apply to all records loaded so far; the status explicitly marks ongoing loading and confirms when the full library is available. Errors retain loaded records and a retry cursor. The in-memory index is reused while the owner stays signed in; Refresh library reloads it, and library saves invalidate it. No new composite index is needed. This trades initial owner-only document reads for immediate combined filters and sorting; large catalogs may take time to load. Image requests are limited to displayed tiles and use lazy loading.

**Recently added** uses immutable server `createdAt` timestamps on new records. For legacy version-1 records, the initial `updatedAt` is their first save and can be retained as the added date. Legacy records edited multiple times without a creation timestamp keep an unknown date and sort after known dates. Later edits are not presented as new additions; no historical dates are invented.

Library edits do not update previously added pack snapshots or historical winnings. This keeps CSV price changes from altering pack economics without review. Existing pack entries remain editable in the Packs view.

## Storage and release

`cardLibrary/{stableId}` is owner-only Firestore data, paginated in groups of 50 using normalized name/document ID ordering. Saved-name search is a prefix search; it does not scan every card. There is no shared 100-card library cap. Selected cards are limited to 500 per operation. Images are referenced by URL; the importer does not upload or copy third-party artwork to Storage.

Deploy the updated **Firestore rules before using live library saves**. The added-date metadata requires the updated **Firestore rules** before new imports/edits. This feature adds no Cloud Function, secret, Storage rule, subscription or paid provider. Normal Firestore reads/writes still apply. The cumulative deferred backend command is in [STATUS.md](STATUS.md). No deployment or production data mutation was performed during development.

Verification: domain tests cover USD market quotes, finish matching, missing/invalid prices, timestamp handling, exact-ID updates, grades, CSV, pack invariants and provider failures. Browser fixtures cover 320/390/1440px, per-card/bulk import rarity, library-only imports, priced imports, finish selection, linking existing cards, slab exclusion, unavailable-price retention, version conflicts, full-library picker pagination/retry, combined filters, selection persistence, draft additions, disabled cards and sign-out cleanup. Rules tests cover private owner access, revisions and field validation; emulator execution remains blocked by its uncached JAR download.

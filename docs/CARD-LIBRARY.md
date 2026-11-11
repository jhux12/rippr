# Card library

Open `/admin` with the verified owner account and choose **Card library**.
This is a separate reusable catalog. Saving it does not publish or reprice packs.

## Import Pokémon cards

1. Choose **Import Pokémon**. Search by card name (at least two letters), set ID, or both. For example, `Umbreon` and `swsh7`.
2. Select up to 50 cards across search pages, then **Preview selected imports**.
3. Review the name, set, number and artwork. Existing library IDs are skipped.
4. Save to the library. In **Saved cards**, select cards and use bulk edit to set a rippr rarity and USD value. Those fields start unset; source rarity is not silently mapped to a prize tier or price.
5. Review the physical finish in **Edit** before pricing. TCGdex supplies card-level artwork, which does not identify which physical foil variant you intend to stock. Use a separate CSV ID for a reverse holo, other finish, or graded slab.

English TCGdex imports use stable IDs such as `tdx-en-swsh7-215`. Search is paginated (24 results); detail requests run four at a time and have a 15-second timeout. Recent responses are cached in memory. Missing artwork or malformed details produce an error rather than invented card data. No API key is required by this public endpoint.

The adapter follows the official [TCGdex JavaScript SDK](https://github.com/tcgdex/javascript-sdk) query and card schemas. The [database README](https://github.com/tcgdex/cards-database) and [MIT license](https://github.com/tcgdex/cards-database/blob/master/LICENSE) were accessible during implementation. Direct `api.tcgdex.net` access is denied by this workspace's network policy, so current live search availability, CORS, artwork coverage and image delivery have **not** been verified here. Browser tests use intercepted documented responses. If a deployed browser cannot reach TCGdex, the page shows an error and CSV remains available.

## Near Mint pricing requirement

The owner requires **Near Mint USD pricing for raw cards**, matched to the exact set, printing and finish. Slabs require a separate grader/grade valuation.

Correction to earlier implementation guidance: TCGdex does document embedded TCGplayer market prices without an API key. Its official [market-pricing guide](https://github.com/tcgdex/documentation/blob/master/src/content/docs/markets-prices.mdx) and [card schema](https://github.com/tcgdex/documentation/blob/master/src/content/docs/reference/card.mdx) describe `pricing.tcgplayer` with `unit`, `updated`, finish keys and `marketPrice`. However, that documented structure does not identify condition. `normal` means non-foil, not Near Mint. The documentation alone therefore does not establish a Near Mint-only price. Its [FAQ](https://github.com/tcgdex/documentation/blob/master/src/content/docs/faq.mdx) also records current printing/listing mapping issues.

Automatic market-price application remains disabled. A prototype for generic market-price previews was held back when the owner specified Near Mint. A regression test ensures even a card response containing current USD TCGplayer market prices imports with an unset value. Do not silently replace missing or unverified condition prices with zero, generic market prices, other conditions, other finishes or slab estimates. An explicitly condition-aware pricing source or authoritative confirmation of the feed's condition semantics is required before enabling automatic Near Mint pricing. Existing owner-entered CSV values remain usable.

## Import and update CSV values

Use **CSV import → Download CSV template**, or select saved cards and **Export selected CSV**. Import up to 500 rows / 2 MB at a time. Supported headers:

```csv
id,name,setName,number,finish,image,rarity,value,gradingCompany,grade,referenceURL
```

- `id` is required. A new card also needs `name` and a valid image URL/site asset path.
- To update prices, an `id,value` CSV is enough. Values are USD (`2.50`), never cents, and require at most two decimal places. Blank cells keep existing fields. Zero is a valid explicit value; blank new values stay unpriced.
- Use **Update supplied fields** to edit existing IDs or **Skip existing cards** to leave them alone. Duplicate IDs within a file and invalid rows block saving until corrected. Existing image, finish, grade and source metadata are retained on partial updates.
- Slabs require both `gradingCompany` and `grade`. Supported companies/grades match the pack editor. Use a distinct ID such as `umbreon-swsh7-215-psa10` and the slab photo. A raw and PSA-10 copy are separate records with separate values.
- Optional `referenceURL` accepts HTTPS TCGplayer links. It is a reference only. No TCGplayer scraping, market-price synchronization, credential or purchase integration is included.
- CSV quoting supports commas, embedded newlines, doubled quotes, UTF-8 BOM and CRLF. Exports escape spreadsheet formula prefixes. If you export a card name starting with a formula prefix, remove the protective apostrophe only when intentionally editing that name; a price-only import avoids changing it.

Every import has a preview. Saving uses atomic batches of at most 50 cards and checks each card's revision. If batch two fails after batch one succeeds, only unsaved rows remain in the preview. Retry saves those remaining rows. A revision conflict requires discarding/rebuilding the preview from refreshed records; it never silently overwrites another session.

## Reuse cards in packs

**Copy pack cards** previews the loaded pack drafts in the library and skips existing library IDs. No automatic migration runs.

In **Saved cards**, select priced cards with a rippr rarity, choose a pack and click **Add to pack draft**. Existing IDs in that pack are skipped; their metadata, values, grail flags and odds stay unchanged. New cards start at 0% odds and are not grails automatically. Each pack retains its 100-card limit. Use its EV calculator (include the new zero-odds cards explicitly) or set odds yourself, review the total, then **Save changes** to publish. Library grades are retained.

Library edits do not update previously added pack snapshots or historical winnings. This keeps CSV price changes from altering pack economics without review. Existing pack entries remain editable in the Packs view.

## Storage and release

`cardLibrary/{stableId}` is owner-only Firestore data, paginated in groups of 50 using normalized name/document ID ordering. Saved-name search is a prefix search; it does not scan every card. There is no shared 100-card library cap. Selected cards are limited to 500 per operation. Images are referenced by URL; the importer does not upload or copy third-party artwork to Storage.

Deploy the updated **Firestore rules before using live library saves**. This feature adds no Cloud Function, secret, Storage rule, subscription or paid provider. Normal Firestore reads/writes still apply. The cumulative deferred backend command is in [STATUS.md](STATUS.md). No deployment or production data mutation was performed during development.

Verification: domain tests cover pricing, exact-ID updates, grades/finishes, malformed CSV, duplicates, pack invariants and provider failures. Browser fixtures cover 320/390/1440px, import/edit/bulk/add flows, batch retry, revision conflicts and sign-out cleanup. Rules tests cover private owner access, revisions and field validation; emulator execution remains blocked by its uncached JAR download.

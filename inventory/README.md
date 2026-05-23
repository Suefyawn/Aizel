# Aizel inventory imports

Drop your eBay export CSV into this directory as `ebay.csv`, then run:

```bash
# Dry run — parses + reports without touching the database
npm run import:ebay -- --dry-run

# Live import — needs Supabase env vars set in .env.local
node --env-file=.env.local scripts/import-ebay-inventory.mjs
```

## Where to get the CSV

1. Sign in to **eBay Seller Hub** → **Listings** → **Active**.
2. Tick all listings → **Action ▾** → **Download report** → CSV.
3. Save the file here as `ebay.csv`.

(File Exchange exports also work — the importer accepts both column-naming conventions.)

## Customising the mapping

If your listings use category names the importer doesn't recognise, edit `CATEGORY_MAP` in
[`scripts/import-ebay-inventory.mjs`](../scripts/import-ebay-inventory.mjs) to add more
"contains this keyword → Aizel category" rules.

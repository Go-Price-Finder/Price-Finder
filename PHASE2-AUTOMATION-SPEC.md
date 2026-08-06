# Phase 2 — Import & Compliance Automation Spec

The detailed spec for the partner-import automation system to be built in
Phase 2, once Phase 1 (design/UX) is finished. **Not being built yet** — this
is a planning document.

## The Core Problem Being Solved

Right now, every time new partner data comes in, it takes multiple chats,
manual fixes, broken images, uncategorized products, and days of
back-and-forth. The goal is one system that takes any partner's raw data and
turns it into a fully working, compliant, live site update — with zero
manual intervention.

## What The Automation System Needs To Do, Start to Finish

### Step 1: Compliance Check (gatekeeper — runs first, always)

- Before any data touches the site, check `lib/partner-compliance.json` for
  that partner
- If the partner isn't listed, isn't `"active"`, or hasn't confirmed as a
  valid comparison-engine partner → block the import entirely
- If image usage permission is pending → block images specifically, use
  placeholder
- If the partner prohibits copying their product descriptions (plagiarism
  clause) → flag descriptions that too closely match the raw feed text for
  rewrite
- If certain products/categories are excluded from commission → flag those
  so they don't get featured in "Best Sellers" or "Deals"
- Output a clear pass/fail report before anything else happens

### Step 2: Data Ingestion (flexible for any partner, any format)

- Accept either a CSV file or, in the future, a live API feed
- Use a simple config file per partner that maps their column names/API
  fields to standard fields: name, price, category, image URL, description,
  deep link, SKU
- Support a filter option — so imports can be limited to specific categories
  or a max product count (important for huge catalogs like Newegg/IKEA — no
  need to import 50,000 items at once)
- Validate every row/record — skip or flag anything missing critical data
  (name, price, deep link) instead of breaking the whole import

### Step 3: Auto-Categorization

- No new category gets created per partner — everything maps into a small,
  fixed set of parent categories (roughly 8-10 total, like Home & Garden,
  Electronics, Fashion, Food & Beverage, etc.)
- A keyword/mapping table decides which parent category each product
  belongs to automatically
- Categories with zero products stay hidden from navigation
- Category pages show only their own products — never everything stacked
  together

### Step 4: Image Handling

- Auto-download every image from the feed to `public/images/{partner-slug}/`
- Standardize naming (lowercase, hyphenated)
- Verify no broken or empty files; log failures clearly
- Respect the compliance gate — skip displaying images if permission isn't
  confirmed yet

### Step 5: Product Card & Site Placement (enforced automatically, every time)

- Fixed card dimensions, consistent image sizing, name/price/rating/badge
  placement identical across every partner
- Auto-populate homepage sections: Best Sellers, Popular Categories, Our
  Partners, Best Deals (hides itself if no deals exist), Trending Products
- No manual placement — the script decides where each product goes based on
  its data (category, badge status, rating, etc.)

### Step 6: Search Integration

- Every imported product is automatically searchable
- Fuzzy matching built in — typos, missing letters, and alternate spellings
  still return relevant results
- No manual "wiring" required per import — new products are searchable the
  moment they're imported

### Step 7: Verification & Reporting

- After import: check every product has all required fields, no duplicate
  IDs, all images exist and match, all deep links are valid URLs
- Print a clear summary: X products imported, X categories affected, X
  compliance warnings, X image failures
- Never auto-push to GitHub — the script stops and waits for confirmation
  after showing the report

### Step 8: Documentation

- A short `IMPORT-GUIDE.md` so this process can be repeated by anyone (even
  without deep coding knowledge) — how to structure a config file, where to
  drop the CSV, how to run it, what the report means

## The End Goal

Drop a CSV + a small config file into a folder, run one command, and get:

- Every product correctly categorized, imaged, priced, and searchable
- A compliance report confirming nothing violates any advertiser's terms
- A clean summary to review before pushing live

No more juggling three separate chats, no more broken images, no more messy
categories, no more manual fixes after each import.

## Dependency on Phase 1

The final 8-10 category list landed on during Phase 1 restructuring becomes
the fixed parent-category set this automation script maps every future
import into. The category structure decided in Phase 1 needs to be stable
enough that a Newegg or IKEA import later maps cleanly into it without
inventing new categories.

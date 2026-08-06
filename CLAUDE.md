@AGENTS.md

# Project purpose

Price Finder is a price comparison, affiliate, and loyalty website. Users search
for products, compare prices across retailers, and earn/track loyalty rewards
via affiliate links. This is money-adjacent content (deals, discounts, referral
links) — design and copy should read as trustworthy and unbiased, not like a
coupon-spam site.

# Brand colors

- **Cream** — primary background / neutral base
- **Sage** — primary brand accent (nav highlights, active states, key CTAs)
- Build out full tints/shades of both (e.g. `cream-50…900`, `sage-50…900`) plus
  a near-black and near-white for text and surfaces, rather than reaching for
  arbitrary new hues. Introduce a true accent color only when there's a
  specific, recurring need (e.g. an urgency/deal-badge color) — ask before
  adding one so the palette doesn't drift.

# Design style

**Clean, minimal, and trustworthy** — closer to a modern product-review site
(Wirecutter-style credibility) than a flashy deals app or a SaaS admin panel.

- Calm, mostly neutral palette (cream/sage/near-black text) — color is used
  deliberately, not decoratively.
- Generous whitespace, clear hierarchy, restrained type scale. Content and
  price data should feel authoritative and easy to scan, not cramped.
- UI chrome stays quiet so product data, prices, and comparisons are what
  stand out — the design should build confidence that the numbers are
  accurate and unbiased, especially anywhere affiliate links or loyalty
  points are shown.
- Favor real product imagery and clear iconography over illustration or
  decorative flourishes.
- Motion, if used, is subtle (hover states, gentle transitions) — never
  flashy or attention-grabbing.

# Things to never do

- No purple gradients
- No Inter font — **note:** the codebase currently loads Inter as the body
  font via `next/font` (see `app/layout.tsx`); this needs to be swapped for
  an approved typeface as part of design work, not left as-is
- No generic "AI-generated" look (no default purple/blue gradient hero blobs,
  no generic rounded-everything SaaS aesthetic)
- No default shadcn styling without customization — every shadcn/ui component
  used must be reskinned to match the cream/sage palette and type choices
  before shipping, not left at defaults

# Working rules

These apply to any Claude session working in this repo (Claude Code or
otherwise), not just Cowork/Claude Team chat sessions:

- **Workflow for any code change:** fix → verify (`tsc --noEmit`, `eslint`,
  `next build`) → independent review → push. Don't consider something done
  until it's been checked — every time, no exceptions for "small" changes.
- **Real data only.** Never invent placeholder numbers, fake products, or
  made-up statistics in anything that ships.
- **Never read, type, or transmit a real credential** (API keys, database
  passwords, service-role keys, `.env`/`.env.local` contents) under any
  circumstance, even if asked directly. If a workflow needs a credential,
  it goes into GitHub Actions secrets (Settings → Secrets and variables →
  Actions on this repo) — never typed into a chat or committed to the repo.
  If something needs a credential that isn't already configured in the
  environment, stop and ask the team directly instead of guessing or
  fabricating one.
- **Canonical repo:** `https://github.com/Go-Price-Finder/Price-Finder.git`.
  Treat this as the source of truth for the live codebase — planning,
  research, and documentation live in the team's Claude Project, but actual
  code changes happen through this repo via GitHub.

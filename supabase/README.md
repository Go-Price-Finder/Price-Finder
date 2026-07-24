# Supabase setup

This folder holds the database schema for Price Finder's user accounts,
wishlists, and purchase history, plus the auth system built on top of it
(sign up, log in, sessions, a protected dashboard). It's independent of the
loyalty-points system, which will build on top of this once it exists.

## What's here

- `migrations/0001_initial_schema.sql` — the full schema: tables, enum,
  indexes, a spend-summary view, and Row Level Security policies. Fully
  commented with the reasoning behind each choice.
- `migrations/0002_add_username.sql` — adds a format check (3–20 chars,
  letters/numbers/underscore/dash) and a case-insensitive unique index on
  `users.display_name`, and updates `handle_new_user()` to populate it from
  the username collected on the sign-up form.
- `migrations/0003_add_target_price.sql` — adds `target_price`,
  `alert_sent`, and `alert_sent_at` to `wishlists` for the price-drop alert
  feature, plus a trigger that resets `alert_sent` when `target_price`
  changes and an update RLS policy so users can set their own target price.
  See "Price drop alerts" below.
- `seed.sql` — populates `products` from the same catalog the frontend
  already uses (`lib/data.ts`), so wishlists/purchases have real products to
  reference. Safe to re-run.
- `example-queries.sql` — the two queries called out in the original
  requirements ("all purchases by a user", "total spending"), plus a couple
  more, written against the indexes that make them fast.

## One-time setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is
   fine to start).
2. In the Supabase dashboard, open **SQL Editor** and run
   `migrations/0001_initial_schema.sql`, then `migrations/0002_add_username.sql`,
   then `migrations/0003_add_target_price.sql`, then `seed.sql`. (If you use the
   [Supabase CLI](https://supabase.com/docs/guides/local-development)
   instead, `supabase link` to your project and run `supabase db push`.)
3. In **Settings → API**, copy the **Project URL** and **anon public** key.
4. In the app root, copy `.env.local.example` to `.env.local` and fill in
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Leave
   `NEXT_PUBLIC_SITE_URL` as `http://localhost:3000` for local dev; set it
   to your real deployed URL in production.
5. **Auth redirect URL** — in **Authentication → URL Configuration**, add
   `http://localhost:3000/auth/callback` (and your production equivalent)
   to **Redirect URLs**. This is required for the email confirmation link
   Supabase sends on sign-up to work — Supabase rejects redirects to URLs
   not on this list.
6. Restart `npm run dev` so Next.js picks up the new env vars.

That's it — `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts`
(Server Components / Route Handlers / Server Actions) are ready to use, and
`middleware.ts` at the project root keeps auth sessions refreshed.

## Schema overview

| Table | Purpose | Key columns |
|---|---|---|
| `users` | 1:1 profile row per Supabase Auth user | `id` (= `auth.users.id`), `email`, `created_at` |
| `products` | Normalized product catalog | `id`, `name`, `category` |
| `wishlists` | Saved items per user, tagged by retailer | `user_id`, `product_id`, `retailer`, `price_saved` |
| `purchases` | Purchase history, append-only | `user_id`, `product_id`, `retailer`, `amount_spent`, `purchased_at` |

A few decisions worth calling out:

- **No password column, anywhere.** Supabase Auth's built-in `auth.users`
  table already stores email + a securely hashed password + `created_at`,
  and handles verification and password resets. `public.users` is a profile
  row keyed on that same `id` (auto-created by a trigger on signup) — it's
  what the rest of the schema references, but it never touches credentials.
- **Products are normalized**, not duplicated as free text on every
  wishlist/purchase row — both tables reference `products.id` by foreign
  key, which is what makes joins like "my purchases with product names"
  possible without redundant data.
- **Retailer is a Postgres enum** (`amazon`, `walmart`, `etsy`, `target`,
  `ebay`), matching the `RetailerId` type already used in the frontend
  (`lib/types.ts`) — so a bad retailer value is rejected at the database
  level, not just in the UI.
- **Indexing is built around the two queries in the requirements**: a
  composite index on `purchases (user_id, purchased_at desc)` covers "all
  purchases by a user" (already sorted, most recent first) in one index
  scan, and the `user_spending_summary` view pre-expresses the `SUM(...)
  GROUP BY user_id` for total spending. Extra indexes on `product_id` and
  `retailer` support the reporting queries you'll likely want next
  (top-purchased products, spend by retailer).
- **Row Level Security is on for every table.** Each user can only read/
  write their own `users`, `wishlists`, and `purchases` rows; `products` is
  public read-only catalog data. See the policy comments in the migration
  for the one caveat worth knowing about (client-side purchase inserts).
- **Purchases are treated as an append-only ledger** — no update/delete
  policy is granted, so once recorded, a purchase can't be edited or
  deleted by the user.

## Authentication

Built entirely on Supabase Auth — no custom password handling anywhere.

| Route | What it does |
|---|---|
| `/auth/signup` | Email + password sign-up (`components/AuthForm.tsx`) |
| `/auth/login` | Email + password sign-in, same form component |
| `/auth/callback` | Exchanges the email confirmation link's code for a session, then redirects to `/dashboard` |
| `/dashboard` | Server-rendered: profile, total spend, purchase history — redirects to `/auth/login` if signed out |

How the pieces fit together:

- **`lib/supabase/actions.ts`** — Server Actions (`signUpAction`,
  `signInAction`, `signOutAction`) that call `supabase.auth.*` using the
  server client. Sign-up handles both possible project configurations:
  if Supabase returns a session immediately (email confirmation disabled),
  it redirects straight to the dashboard; otherwise it sends the user to
  `/auth/login?confirm=1` to wait for the confirmation email.
- **`lib/auth-context.tsx`** — a client-side `AuthProvider` (wired into
  `app/providers.tsx`) that tracks the current user via
  `supabase.auth.getUser()` on mount and `onAuthStateChange` afterward, so
  the header updates instantly on login/logout and stays in sync across
  tabs. This is what makes the Header's Sign In / Dashboard / Log out state
  reactive without a page reload.
- **`middleware.ts`** — refreshes the session cookie on every request
  (required for Server Components to see a valid session) and redirects
  signed-out visitors away from `/dashboard` before the page even renders.
  `app/dashboard/page.tsx` also checks `auth.getUser()` itself as a second
  layer, in case the page is ever reached another way.
- **Sessions persist across refreshes** because Supabase's `@supabase/ssr`
  client stores the session in cookies (not `localStorage`), which both the
  middleware and server components read on every request — this is what
  "built-in session management" is doing under the hood, not anything
  custom in this app.

## Wishlist and purchase tracking

Both now read and write the database instead of mock data:

- **Wishlist** — `lib/wishlist-context.tsx` fetches a signed-in user's rows
  via `getWishlistByUser` on load, and the heart button on each product
  card calls `addToWishlist` / `removeFromWishlist` (both from
  `lib/supabase/queries.ts`) through the context's `toggle()`. Signed-out
  visitors are sent to `/auth/login` when they tap the heart, since a
  wishlist row needs a `user_id`. `/wishlist` renders straight from the
  context, showing the retailer and price at the moment each item was
  saved (`price_saved`), not a live price — the `products` table doesn't
  carry a current price, only catalog metadata.
- **Purchase tracking** — clicking "View Deal" on a product card
  (`components/BuyButton.tsx`) opens the retailer link and, for signed-in
  users, calls the `recordPurchaseAction` server action
  (`lib/supabase/actions.ts`), which re-checks `auth.getUser()` server-side
  and calls `recordPurchase`. This is the server-side tightening the
  migration's security note called for — `amount_spent` and `user_id` come
  from the authenticated session and the product's own catalog price, never
  from client input. `/purchases` lists the full history
  (`getPurchasesByUser`, most recent first); the dashboard shows the most
  recent 5 with a "View all" link. Both pages share
  `components/PurchaseHistoryTable.tsx`.

## Loyalty tiers

Bronze / Silver / Gold / Diamond, shown on the dashboard via
`components/LoyaltyTierCard.tsx`. There's no `loyalty_points` column or
similar anywhere in the schema — `lib/loyalty.ts` derives points straight
from `user_spending_summary.total_spent` (10 points per $100 spent) and
looks up the tier from a fixed threshold table (Bronze 500, Silver 1500,
Gold 3000, Diamond 13000). Nothing to keep in sync: spend more, the next
dashboard render reflects it automatically. If tiers ever need to unlock
real perks (discounts, early access), that's the point to add a persisted
`loyalty_tier` or `loyalty_points` column instead of computing on the fly.

## Price drop alerts

Users can set an optional target price on any wishlist item ("Notify me
when price drops below $___", on `/wishlist` via
`components/TargetPriceCell.tsx`). A daily job compares each target against
the product's current price and emails the user when it's been met.

How the pieces fit together:

- **`migrations/0003_add_target_price.sql`** — adds `target_price`
  (nullable numeric), `alert_sent` (boolean, default false), and
  `alert_sent_at` (nullable timestamptz) to `wishlists`. A trigger resets
  `alert_sent` to false whenever `target_price` changes, so editing an
  already-alerted item makes it eligible for a new alert. Also adds the
  `wishlists` update RLS policy needed for users to set their own target
  price (0001 only granted select/insert/delete).
- **`lib/supabase/queries.ts`** — `setWishlistTargetPrice()` updates a
  row's `target_price`; `getWishlistByUser()` now selects the new columns
  too, surfaced through `lib/wishlist-context.tsx`'s `setTargetPrice()`.
- **`lib/alerts/evaluateAlertState.ts`** — the pure decision logic for one
  row: given `target_price`, the current price, and whether `alert_sent` is
  already true, should the job send an email, reset the flag, or do
  nothing? Kept separate from the I/O so it's unit-testable without a live
  Supabase project (`scripts/test-alert-logic.ts`).
- **`lib/alerts/checkPriceDrops.ts`** — the job itself. Queries every
  `wishlists` row with a `target_price` set (via
  `lib/supabase/admin.ts`'s service-role client, since it has to see every
  user's rows, not just one signed-in caller's), looks up each product's
  current price, and applies `evaluateAlertState()`'s decision: send the
  email via Resend and mark `alert_sent = true` / `alert_sent_at = now()`,
  or reset `alert_sent = false` if the price has climbed back above target
  since the last alert (the one reset case the database trigger can't
  handle, since it never sees the live price).
- **`lib/email/resend.ts`** / **`lib/email/templates/priceDropAlert.ts`** —
  the Resend client and the HTML email template (product name, old/new
  price, savings, retailer, a "View deal" button).
- **`app/api/cron/check-price-alerts/route.ts`** + **`vercel.json`** — a
  Vercel Cron job hits this route once a day; the route checks the
  `Authorization: Bearer $CRON_SECRET` header Vercel sends automatically
  before calling `checkPriceDrops()`.

**No live price feed yet** — same caveat as "View Deal" below.
`checkPriceDrops()`'s "current price" lookup reads the mock catalog in
`lib/data.ts` (`trendingProducts`), the same data every product card
already renders from. Swap that one lookup for a real feed later and
nothing else in the flow needs to change.

**Manual setup required, beyond running the migration:**

1. Create an account at [resend.com](https://resend.com) and generate an
   API key (**API Keys** in the dashboard) — set it as `RESEND_API_KEY`.
2. Verify a sending domain (**Domains → Add Domain**) and point
   `RESEND_FROM_EMAIL` at an address on it (e.g.
   `"Price Finder <alerts@yourdomain.com>"`). Until you do, emails fall
   back to Resend's shared `onboarding@resend.dev` sender, which is
   rate-limited and fine for testing but not for real users.
3. Copy the **service_role** key from Supabase **Settings → API** (not the
   anon key) into `SUPABASE_SERVICE_ROLE_KEY`. Never expose this to the
   browser.
4. Set `CRON_SECRET` to any long random string, both locally (optional —
   the check is skipped if it's unset) and as a Vercel project env var
   (required in production; Vercel wires it into its cron requests
   automatically once it sees that exact name).
5. On Vercel, cron jobs are picked up automatically from `vercel.json` on
   deploy — no dashboard configuration needed beyond the env vars above.

## What this doesn't include yet

- **Real affiliate links** — `getAffiliateUrl()` in `lib/data.ts` points at
  each retailer's own search for the product name (there's no live product
  feed with real listing URLs yet), so "View Deal" is a stand-in for a real
  affiliate redirect, not the genuine article.
- **Password reset / forgot-password flow** — not built; Supabase Auth
  supports it (`resetPasswordForEmail`), it just isn't wired up here.

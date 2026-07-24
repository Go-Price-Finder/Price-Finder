# Price Finder

A modern, premium price comparison website built with Next.js 15 (App Router), TypeScript, and Tailwind CSS 4.

## Stack

- **Next.js 15** — App Router, React Server Components
- **TypeScript** — strict mode
- **Tailwind CSS v4** — custom design tokens (colors, shadows, fonts, animations) defined in `app/globals.css`
- **next/font** — `Inter` (body) and `Fraunces` (display/serif headlines) from Google Fonts
- **Supabase** — database schema and full email/password auth (sign up, log in, sessions, protected dashboard); see `supabase/README.md`

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  layout.tsx        Root layout, fonts, metadata
  page.tsx           Home page — assembles all sections
  globals.css         Design tokens (colors, shadows, animations) + Tailwind import
components/
  Header.tsx           Sticky header: logo, nav, search, mobile menu
  Hero.tsx              Hero section with headline + large search bar + stats
  SearchBar.tsx        Reusable interactive search input (used in header, hero, footer)
  TrendingNow.tsx       Horizontally scrolling product rail with arrow controls
  ProductCard.tsx       Product card with best-price badge, discount, rating
  PopularCategories.tsx Category grid with image cards
  HowItWorks.tsx         3-step "how it works" section
  Footer.tsx             Footer with link columns + newsletter signup
  Logo.tsx / icons.tsx   Shared logo + inline SVG icon set
app/
  auth/signup, auth/login  Sign-up / login pages
  auth/callback            Email confirmation link handler
  dashboard/               Profile, spending stats, recent purchases (auth-gated)
  purchases/               Full purchase history (auth-gated)
  wishlist/                Saved items, read from Supabase (auth-gated)
lib/
  types.ts              Product / Category types
  data.ts                Mock product & category data + price/date formatters + affiliate link builder
  auth-context.tsx       Client-side auth state (used by Header)
  wishlist-context.tsx    Client-side wishlist state, backed by the `wishlists` table
  supabase/              Supabase client factories, typed Database type, query helpers, server actions
supabase/
  migrations/            SQL schema (users, products, wishlists, purchases)
  seed.sql                Seeds the product catalog to match lib/data.ts
  example-queries.sql      Reference queries the schema is indexed for
middleware.ts            Refreshes auth sessions + protects /dashboard and /purchases
```

## Design system

Defined via Tailwind v4's `@theme inline` in `app/globals.css`:

- **Colors** — warm cream/sand neutrals (`cream-*`, `sand-*`), soft ink text scale (`ink-*`), a sage green accent (`sage-*`) used specifically for "Best Price" badges and highlights, and a muted clay accent for ratings.
- **Shadows** — `shadow-soft`, `shadow-soft-lg`, `shadow-soft-xl` for the layered, soft-shadow "premium" look.
- **Fonts** — `font-display` (Fraunces, a serif) for headlines, `font-sans` (Inter) for body copy.
- **Animations** — `animate-fade-up` for hero entrance, plus hover-driven transitions (scale, translate, shadow) throughout for interactivity.

All product/category imagery currently comes from Unsplash as placeholder photography — swap `lib/data.ts` for real product data / a real API when ready.

## Notes

- All interactive pieces (search bar, mobile nav, horizontal scroller) are client components; everything else renders on the server.
- `next.config.ts` allows remote images from `images.unsplash.com` — add your real image domains there when you wire up live data.
- Font fetching requires outbound network access to `fonts.googleapis.com` at build time (this is normal for any Next.js project using `next/font/google`, and works out of the box on `npm run dev`, `npm run build`, or any standard deploy target like Vercel).

## Database & authentication

The schema for user accounts, wishlists, and purchase history — plus a full
email/password auth system built on Supabase Auth (sign up, log in,
sessions that persist across refreshes, a protected `/dashboard`) — lives
in `supabase/` and `app/auth/`. See `supabase/README.md` for setup steps
and the reasoning behind the schema and auth design. The wishlist and
purchase-tracking features are both wired to the database now — saving an
item or clicking "View Deal" writes to `wishlists` / `purchases` for the
signed-in user; see the "Wishlist and purchase tracking" section of
`supabase/README.md` for how the pieces fit together.

## Deploy

The easiest way to deploy is [Vercel](https://vercel.com/new). See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for other options.

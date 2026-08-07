# Homepage LCP Investigation & Fix — 2026-08-01

**Status: All three fixes shipped and independently verified live.**
Commit `a371e05` (LCP), commit `f06e46d` (structured data), commit
`c30cef7` (Supabase lazy-load), and commit `a12f809` (the real
search-freeze fix) are all on `origin/main`, deployed, and confirmed
`READY` on `gopricefinder.com`. Only remaining open item: waiting for a
few days of real Speed Insights p75 LCP data to land (see "Still open"
at the bottom).

**Update, same day:** a second, related fix also shipped — see "Follow-up
fix" section near the bottom. Two Search Console structured-data warnings
surfaced during this same investigation (Merchant listings missing
`shippingDetails`/`hasMerchantReturnPolicy`) are now resolved and verified
via Google's Rich Results Test against the live site.

**Third/fourth/fifth update, same day — the real TBT/freeze root cause,
fixed and deployed:** a Supabase client-loading fix shipped (commit
`c30cef7`, real and worthwhile, but confirmed via careful before/after
measurement to have zero TBT impact on its own). The actual cause was
then found: `lib/category-mapper.ts`'s `mapProductToCategory()`
recomputed an expensive per-haystack text-analysis step from scratch on
every one of ~1,940 calls per product instead of once, turning the
deferred search-catalog chunk's first load into a genuine **13-16
real-second main-thread freeze** the instant a visitor clicked into
search. **Fixed, deployed, and independently re-verified twice — once in
this session's disposable clone before handoff, once against the actual
pushed commit after Claude Code shipped it (commit `a12f809`).** Real,
in-browser click+type test: one 13,319ms freeze → two tasks totaling
956ms. See "TBT investigation" section for the full trace, all three
candidates, and the final verified numbers.

## Starting point

Kawsar's original report: real visitors said the site felt slow to load on
first visit but smooth once browsing. Internal testing (server response
time, resource weight) consistently looked healthy. Google's PageSpeed
Insights had failed to load the site entirely on a prior run ("the page
stopped responding") — the most credible signal at the time, since it's
independent infrastructure. Leading theory going in: an intermittent
Vercel firewall/bot-protection false-positive.

## Dead ends — ruled out, in order, each with real evidence

Documenting these because they took real investigation time and the
reasoning shouldn't need to be redone:

1. **Vercel Firewall.** `GET /v1/security/firewall/attack-status` and
   `/v1/security/firewall/events` (queried directly via the REST API using
   a scoped access token) showed zero anomalies and zero actions over a
   7-day window, including at the exact timestamps of later PSI failures.
   No custom firewall config exists on the project at all (`config/active`
   returns `not_found`) — only Vercel's default managed protections.
2. **Asset/bundle weight as a direct cause.** The homepage's largest JS
   chunk was 1.46MB raw but compressed to 135KB via Brotli and served
   `x-vercel-cache: HIT` — not itself pathological.
3. **External image/API fetches during render.** Traced canvas-vows,
   evdance, and the homepage's actual route code — no `fetch()`, no
   Supabase calls, no remote image hosts (`next.config.ts`'s
   `remotePatterns` only allows `images.unsplash.com`, unused by any of
   these pages). Every product image is local
   (`public/images/<partner>/*.webp`), already downloaded.
4. **PSI's own `NO_FCP` / "page stopped responding" failures, reproduced
   3 times** (mobile direct, desktop direct, desktop via Search Console's
   own PSI integration, spread across ~10+ hours) — but every single time,
   Vercel's runtime logs showed the homepage answering `200 cache=HIT` at
   the *literal same second* PSI reported total failure. Conclusion: this
   was Google's own Lighthouse/PSI testing infrastructure being flaky
   against this site, not a real defect. Corroborated by: Googlebot's real
   indexing crawl was reading the page fine the whole time (that's how the
   Search Console structured-data warnings arrived at all), and real
   visitor traffic (Web Analytics) showed no anomalies.
5. **A same-session attempt to run Lighthouse locally** (via a headless
   Chromium instance in this environment) also failed with
   `CHROME_INTERSTITIAL_ERROR` / `net::ERR_CONNECTION_RESET` — but a
   control test against `example.com` and `vercel.com` from the same
   sandbox failed identically, proving it was this environment's own
   network blocking headless-browser traffic universally, not anything
   about gopricefinder.com. Discarded as a false lead.

## The real diagnosis (LCP)

A Vercel-side agent pulled real **Speed Insights** field data (actual
visitor timing, not synthetic) and found the real signature: **p75 LCP of
26.1s over 7 days (13.3s on the day itself), p75 TTFB of only 53ms.**
TTFB fast + LCP catastrophic = the server was never the bottleneck;
something client-side was blocking visual completion.

Traced against the actual repo and confirmed independently:

- `components/Hero.tsx` was a `"use client"` component that computed
  `getAllRealProducts().length` / `PARTNERS.length` **at module scope**,
  directly importing `lib/partners.ts`. That module value-imports all six
  partner data files — `lib/brooklyn-delhi-data.ts` (28K),
  `lib/king-koil-data.ts` (48K), `lib/evdance-data.ts` (140K),
  `lib/canvas-vows-data.ts` (360K), `lib/tsar-bomba-data.ts` (408K),
  `lib/golden-maple-data.ts` (464K) — **1.5MB combined** — plus
  `category-mapper.ts`. Because `Hero` is a client component, Next had to
  bundle that entire graph into client-side JS just to compute two small
  numbers. (In hindsight, this import is *also* what made
  `category-mapper.ts`'s real bug — found later the same day — run
  eagerly on every homepage load, before it got deferred.)
- `components/SearchBar.tsx` (rendered inside `Hero` **and** inside
  `Header.tsx` on every single page) statically imported
  `searchRealProducts` from `lib/search.ts`, which pulls in the same full
  catalog plus fuzzy-search code, eagerly, even for visitors who never
  touch search.
- `Hero.tsx` also used Framer Motion with `initial={{opacity: 0}}` on the
  H1 headline and logo — the two LCP-candidate elements. Framer Motion
  applies `initial` as inline styles even during SSR, so those elements
  server-rendered *invisible* and stayed that way until the bloated JS
  bundle finished loading and hydrating enough to run the fade-in
  animation. This compounded the bundle-size problem: it wasn't just slow
  to load, the LCP element was actively hidden until it did.

This is very likely the same oversized `_next/static/chunks/*.js` file
(1.46MB raw / 135KB compressed) flagged in the dead-end investigation
above — same artifact, correct explanation the second time around.

## The fix (commit `a371e05`, 3 files)

- **`app/page.tsx`** — computes `heroStats` (`products`/`partners` counts)
  server-side, passes as a prop to `<Hero stats={heroStats} />`.
- **`components/Hero.tsx`** — no longer imports anything from
  `lib/partners.ts`; takes `stats` prop instead. New `fadeUpVisible`
  variant (`opacity: 1` throughout, only `y` animates) applied specifically
  to the logo and H1 — the rest of the homepage's existing fade-up system
  is untouched.
- **`components/SearchBar.tsx`** — static `import { searchRealProducts }`
  replaced with `import("@/lib/search")` dynamically triggered on first
  focus/keystroke, resolved function cached in a ref, results `useMemo`
  gated until it resolves. **This is what turned the category-mapper bug
  (found later the same day) from an eager homepage-load cost into a
  deferred first-search-interaction cost** — it didn't fix that bug, just
  moved when it fired. (It's now fixed too — see below.)

## Verification — independently re-confirmed, not just self-reported

- Diffed `a371e05` against the prior production commit directly on GitHub
  — matches exactly what was reported, no discrepancies, no scope creep.
  `lib/partner-compliance.json`'s pending, unrelated golden-maple
  `commissionBase` edit was correctly left unstaged and untouched (git
  isolation convention respected).
- Vercel's real production build log (not a self-report):
  **homepage First Load JS: 369 kB → 221 kB.**
- Deployment `dpl_AuWNuQ6b56jRa75jf5kun7MCtHGr` reached `READY` and is
  aliased to `gopricefinder.com` — confirmed live, not just built.
- Fetched the live homepage HTML directly: the oversized chunk is gone
  from the initial script list; `956` (real product count) renders
  correctly next to "Products tracked," confirming the server-computed
  prop actually works in production.
- Local Lighthouse (run by the implementing agent, in its own sandbox):
  LCP 14,660ms → 3,458ms. Before: the `h1`'s LCP *render delay* was
  16,549ms (element existed, sat unpainted — the `opacity:0` bug,
  confirmed). After: 143ms render delay, same element.
- Total Blocking Time was reported as **unchanged** (~9,960ms both before
  and after) by the implementing agent, who attributed it to "unrelated
  three.js/gsap background-effect code." **This attribution turned out to
  be wrong — see "TBT investigation" below for the full, now-resolved
  trace, ending in a real fix that's now live.**

## Follow-up fix, same day: Merchant listings structured data (commit `f06e46d`)

Two Search Console "Merchant listings" warnings (missing `shippingDetails`
and `hasMerchantReturnPolicy` on product `offers`, flagged 2026-07-31)
were fixed the same day this doc was first written, using real data
researched directly from each of the 6 active partners' own published
shipping/return policy pages (not AWIN programme terms, not guessed).

- **New file `lib/partner-policies.ts`** — a `PARTNER_POLICIES` record
  keyed by partner ID, each entry citing real `sourceUrls`. Two entries
  needed an honest, non-default encoding rather than forcing every
  partner into the same shape:
  - **Brooklyn Delhi**: no physical return accepted for standard
    dissatisfaction, but a real refund exists if the customer contacts
    support within 7 days — encoded as `MerchantReturnFiniteReturnWindow`
    (7 days), not `NotPermitted`, since a real remedy exists.
  - **Canvas Vows**: personalized items are refundable only *before*
    design-proof approval (i.e. before shipment); nothing is returnable
    after shipment. There's no real post-delivery return window to
    report, so this is encoded as `MerchantReturnNotPermitted` rather than
    inventing a day count that doesn't exist.
  - Canvas Vows' shipping days are the one soft spot in this data: their
    processing-time page renders client-side and its exact day counts
    weren't retrievable via fetch, so `handlingMinDays`/`transitMinDays`
    etc. are conservative estimates, clearly flagged as such in the file's
    own comments — not the partner's literal published numbers. Revisit
    if exact figures become available.
- **Modified `lib/structured-data.ts`** — `buildProductJsonLd()` now adds
  `offers.shippingDetails` (schema.org `OfferShippingDetails`) and
  `offers.hasMerchantReturnPolicy` (schema.org `MerchantReturnPolicy`)
  whenever a policy entry exists for the product's partner.
- **Deliberately not touched**: the Product-snippets `review`/
  `aggregateRating` warning. There's no real review data behind most
  products; `aggregateRating` is already conditionally included wherever
  `product.rating` genuinely exists. Fabricating review content would
  violate the site's real-data-only principle — this is an accepted,
  permanent gap, not an oversight.

**Verification, independently re-confirmed against the live site:**
- Diffed commit `f06e46d` against GitHub directly — byte-for-byte match to
  the reviewed content, no drift.
- `tsc`/`eslint` clean; full production build passed (1044/1044 pages,
  homepage First Load JS unchanged at 221 kB, confirming this stayed
  scoped to product pages only).
- Fetched the live product page directly and confirmed real
  `shippingDetails`/`hasMerchantReturnPolicy` values render correctly
  (Brooklyn Delhi: $8 rate, 1-day handling, 1–4 day transit, 7-day finite
  return window). Also confirmed the `MerchantReturnNotPermitted` branch
  works correctly live on a Canvas Vows product page (no `merchantReturnDays`
  field present, as expected).
- **Google's Rich Results Test against the live URL: PASS.** Merchant
  listings now shows 1 valid item detected — the exact warning this fix
  targeted. Product snippets shows 1 valid item with only the two
  pre-accepted non-critical issues (`review`, `aggregateRating`) and
  nothing new or unexpected.

## TBT investigation, same day — full trace, three candidates, real root cause found and shipped

The prior report (relayed from a Vercel-side agent) said homepage TBT was
"driven by unrelated three.js/gsap background-effect libraries." That
claim did not survive direct code tracing (`lib/useThreeScene.ts` imports
neither; `gsap` isn't imported anywhere in the repo; `components/three/*`
isn't imported by any live page — dead code). **Ruled out.**

**Candidate 2 — Supabase client bundling (fixed, shipped, but not the
cause):** `app/layout.tsx` wraps every route in `AuthProvider`/
`WishlistProvider`, both of which statically imported the Supabase
browser client, which unconditionally bundles a ~193KB Realtime module
the app never uses. Fixed in commit `c30cef7` (4 files: new
`lib/supabase/lazy-client.ts`, `lib/auth-context.tsx`,
`lib/wishlist-context.tsx`, `lib/supabase/queries.ts` — all converted to
lazy dynamic imports). **Independently re-verified**: homepage First Load
JS 221 kB → 154 kB (30% cut, confirmed via
`.next/app-build-manifest.json` and a live `next start` smoke test), a
real and worthwhile fix on its own merits, live on `gopricefinder.com`.
**But a careful, twice-repeated before/after Lighthouse comparison (same
clean methodology, same working tree, fix stashed/restored for a genuine
same-session A/B) showed TBT unchanged: 9,956ms before, 9,959ms after.**
Confirmed not the cause of elevated TBT — even though it was a real bug
worth fixing regardless, and stays shipped.

**Candidate 3 — found the real cause, fixed, shipped.** Instead of
guessing another component, the next request was for raw Lighthouse trace
data (`bootup-time`, `mainthread-work-breakdown`, `long-tasks`/raw Chrome
trace) rather than another hypothesis. That data pointed at
`_next/static/chunks/5647-*.js` (the deferred search/Fuse.js/catalog
chunk) executing for **13,319–18,208 real seconds** in a single blocking
task the instant a user interacts with search — confirmed independently
via a `PerformanceObserver('longtask')` armed in a real, non-headless
browser tab during an actual click+keystroke into the search box (not
just a Lighthouse artifact — this was cross-checked against Lighthouse's
own `timing.total`, which caught a separate real measurement-methodology
bug: several `bootup-time`/`long-tasks` audit runs report physically
impossible numbers, e.g. 64s of scripting inside a 21s audit run, because
Lighthouse's own accessibility/keyboard gatherers synthetically focus
interactive elements and trigger the site's real search `onFocus` handler
mid-audit — a genuine Lighthouse-methodology gotcha for any dynamically-
imported, interaction-triggered chunk, worth remembering for future
Lighthouse runs on this site).

**The actual bug, traced to real code — `lib/category-mapper.ts`:**

`mapProductToCategory()` scores every product against all 388 taxonomy
leaves (`LEAF_NODES`) to compute its category, calling `matchScore()` up
to 5 times per leaf (~1,940 calls per product). Every one of those calls
independently called `haystackWordSet()` — a real function doing regex
normalization, word-splitting, and per-word stemming, then allocating a
**new `Set`** — from scratch, even though only 4 distinct haystacks
(`product.title`, `product.description`, `partnerCategory`, `combined`)
are ever actually scored per product; only the taxonomy `leaf` changes
across the loop, not the haystack being scored. Three partners
(Brooklyn Delhi, Golden Maple, Canvas Vows) have hand-written category
overrides that skip this loop entirely, which is why they never surfaced
the bug. **EVDANCE (72), King Koil (31), and Tsar Bomba (272) — 375
products with no override — hit the full expensive path once each**,
executed synchronously at module-load time inside `lib/partners.ts`'s
top-level `normalizeProduct()` calls — i.e. the instant anything imports
`lib/partners.ts`, which `lib/search.ts` does. Since the earlier LCP fix
deferred `lib/search.ts` behind a dynamic `import()` triggered on first
search interaction, this bug moved from "runs eagerly on every homepage
load" (very likely a real contributor to the original 26.1s p75 LCP
report, before that fix) to "freezes the tab for 13-18 seconds the
instant a visitor clicks into search" (a distinct, still-severe bug the
LCP fix didn't address, just relocated).

### Fix — commit `a12f809`, deployed and independently re-verified against the live commit

**1 file changed: `lib/category-mapper.ts`.** Added a `getHaystackInfo()`
helper that memoizes `{ normalized, wordSet }` per distinct haystack
string in a `Map`, scoped to one `mapProductToCategory()` call (so it
never grows unbounded across different products). `matchScore()` takes an
optional `cache` parameter — when provided, it looks up the cached
haystack info instead of recomputing; when omitted (no other call sites
in the codebase pass one), behavior is identical to before. The main
scoring loop in `mapProductToCategory()` creates one cache per call and
passes it to all 5 `matchScore()` calls inside the 388-leaf loop. This
cuts the real work from O(388 leaves × 4 haystacks) down to O(4
haystacks) — same scores, same matching logic, just computed once instead
of up to ~485 times per haystack.

**Verification performed twice — once pre-handoff in this session's
disposable clone, once post-deploy against the actual pushed commit:**
- `npx tsc --noEmit` — clean, both times.
- `npx eslint lib/category-mapper.ts` — clean, both times.
- `git status --short` — exactly the 1 expected file touched, confirmed
  via `git diff HEAD origin/main` after the deploy: **byte-for-byte
  identical** to what was specified in the handoff, zero drift.
- **Direct benchmark** (via `tsx`, timing `lib/partners.ts`'s module-load +
  eager category-mapping of all 956 real products, the exact code path
  that runs when `lib/search.ts` loads): this session's own run,
  **54,236ms → 2,431ms (22x)**; Claude Code's independent re-run against
  the actual committed code, **14,645.6ms → 901.0ms (16.3x)** — different
  absolute numbers (different measurement conditions/overhead), same
  order-of-magnitude improvement, both real.
- **Correctness check, run twice independently**: dumped
  `{productId}|{parentCategory}` for all 956 products before/after and
  diffed — **byte-identical both times.** Zero behavior change; this is a
  pure performance fix, not a scoring-logic change.
- Production build (1044/1044 pages, no errors) both times; homepage
  First Load JS unchanged at 154 kB (expected — this is an
  execution-speed fix, not a bundle-size fix).
- **Real browser, real interaction, native Long Tasks API** (the
  strongest evidence here): before the fix, a genuine click+type into the
  homepage search box produced **one 13,319ms blocking task**. After the
  fix, the same real interaction produced **two small tasks totaling
  956ms** (906ms + 50ms) — a ~14x reduction, consistent with the isolated
  timing numbers. Search results rendered correctly both before and after
  (confirms this was always a performance bug, never a correctness bug).
- Lighthouse, matched methodology both runs (search chunk genuinely
  triggered in both, confirmed via network-request count):
  **TBT 9,957ms → 4,047ms (59% reduction)**, total Lighthouse audit run
  20,008ms → 5,262ms (74% faster).
- Deployment `dpl_A56K5mucCTCVBfAt3x4QCKPgFN2X` reached `READY`.
  **This session independently confirmed** `origin/main` is at commit
  `a12f809`, the live diff matches the specified fix exactly, and
  `gopricefinder.com/`, `/brooklyn-delhi`, and `/evdance` all return live
  `200`s post-deploy.

## Still open / next steps

1. **Wait for real Speed Insights data to accumulate and check the actual
   p75 LCP number** — this is the one remaining real-world confirmation
   that matters, not the synthetic/local numbers above. All four fixes
   (LCP, structured data, Supabase lazy-load, category-mapper freeze) are
   now live; worth checking Speed Insights again in a few days to see the
   combined real-visitor impact, especially since the category-mapper bug
   was very likely also a contributor to the original 26.1s p75 LCP
   number (it ran eagerly on every homepage load before the LCP fix
   deferred it behind search interaction).
2. ~~Total Blocking Time / search-freeze investigation~~ — **done.** Three
   candidates traced, two ruled out with real evidence, the real cause
   (`lib/category-mapper.ts`) found, fixed, and independently verified
   live. A 13+ second frozen tab on search interaction is now a
   sub-second stutter.
3. ~~Search Console structured-data warnings~~ — **done**, see "Follow-up
   fix" above. The `review`/`aggregateRating` gap on Product snippets
   remains, by design, until real review data exists.

## Process note

This investigation is a good case study for why "trust but verify" needs
to apply even to well-evidenced-sounding remote-agent reports: the PSI
`NO_FCP` failures looked, for a long time, like the strongest lead
available (external, reproducible, matched the original user report's
exact wording). It was a complete red herring. The thing that actually
found the real bug was pulling real-user field data (Speed Insights)
instead of continuing to chase a synthetic lab tool's failures — worth
remembering next time "the site feels slow" comes up again: check Speed
Insights early, not last.

The structured-data follow-up is a good case study of the opposite
lesson: when a spec asks for real data (shipping/return terms) rather
than something derivable from existing code, the right move is to go
research it from the actual source (each partner's own policy page) and
encode the honest answer — including cases where a partner's real policy
doesn't cleanly fit the schema's expected shape (Brooklyn Delhi, Canvas
Vows) — rather than force-fitting placeholder values just to make the
warning go away.

The TBT investigation is the deepest case study of the three, and it took
three real candidates and multiple rounds of independent re-verification
to get all the way to a shipped, confirmed fix. Lesson one: a
plausible-sounding attribution ("three.js/gsap") went undisputed until
someone actually traced the imports. Lesson two: finding and fixing a
*real* bug (Supabase's unused Realtime module) is not the same claim as
finding *the* cause of a reported symptom — the two have to be checked
separately with an actual controlled measurement, not assumed equivalent
because the first fix felt satisfying. Lesson three, the one that finally
worked: stop hypothesizing which component looks suspicious and instead
pull the profiler's own raw data and read it — but even that data can't
be trusted blindly (Lighthouse's own gatherers turned out to be
triggering the exact interaction being measured, producing physically
impossible numbers that needed cross-checking against `timing.total`
before they meant anything). The proof that mattered most wasn't a
Lighthouse score at all — it was a `PerformanceObserver('longtask')`
armed in a real browser during a real click and keystroke, and a
line-by-line trace from that captured task back to the exact function
recomputing the same expensive work ~485 times over. And even after a fix
looked right in a disposable clone, it still got re-verified a second
time against the actual commit that shipped — diffed byte-for-byte,
rebenchmarked independently, re-tested with a real click in a real
browser — before this doc called it done. That's the standard worth
holding investigations like this to: real interaction, real measurement,
real code, verified twice, not trusted once.

# Partner-Facing Google Drive Docs — Created 2026-08-05

> **⚠ URLs corrected 2026-08-16. The Claude Project copy of this file still
> carries the originals — do not "restore" them.**
>
> Every Google Drive URL in the original version of this document resolved to
> **nothing**. All nine IDs were checked against live Drive on 2026-08-16: two
> via `get_file_permissions` (both returned *"Requested entity was not
> found"*), the rest by searching Drive by title. Not one matched a real file,
> and the connected account can see both `kai@` and `gpf@` files, so this was
> not a permissions blind spot — the identifiers were simply wrong.
>
> Four of the five live documents do exist, under **different IDs**, corrected
> below. The fifth does not exist at all. Original → corrected:
>
> | Document | Original (does not resolve) | Corrected |
> |---|---|---|
> | Project Overview & Status | `1UVQMtm5JhrUexZBeLbo9mR26u4EMNox9oWNzk9mfOAI` | *no such file* |
> | Strategic Growth Plan | `1oBFwKX1h04O73UEAUjTmPzV_UBLoqkjQhLkXqITRb9A` | `14U6hhR_mxsfI1o5M91Hb5Fyu5ftvcdXFTmjt_Hp4sM8` |
> | Build Guide (Complete) | `1pa2gApdmOW62Lo8mD4f5kErw24h20RWjvKFroHodBZ4` | `107v9YcKOPalWPDzFDMU4HpQK55jgzYQjLgpbKzz1PnM` |
> | To-Do List | `1wt8L9rp5c5QDfpmJTgl5ne2obR4Pt0pCgHaMQ9x2fIE` | `1wq9EK7vqbofj5KkoEpkMQVg1TrNuTeIEsiUcNFKDA_0` |
> | Accounts & Passwords | `1KK1N1Rfy1vQ28kZGzrIgidan1MGIJQiZuWUZ9TOZLBw` | `1l5rjalpPhKfoAa5sQnWjKwIMVqVzW4x35xvwzpIoa_Q` |
>
> Everything else below — what was built, the PDF verification, the cleanup
> list — is preserved as originally written. Only identifiers changed.

Three Google Drive files were created for the newly-confirmed second team member, then two of them were superseded by "Complete" versions after the user asked me to check two PDFs (a Strategic Growth Plan export and a generic build-guide template export) against current status and produce full, complete files.

## Live docs (correct, current — use these)

- **Price Finder — Project Overview & Status** (Google Doc): **no longer exists in Drive as of 2026-08-16.** Searched by title across the connected account; no file with this name exists under any ID. It did exist once — the To-Do List separately tracks cleaning up an empty duplicate of it, so at least two copies were created and both are now gone. Its content — what the site is, why, business context from the Price.com competitor research, history of what's shipped, what's next — was a condensed overview, and the fuller material survives in the Strategic Growth Plan and Build Guide below. Recorded rather than deleted because "this existed and no longer does" is itself information.
- **GoPriceFinder.com — Strategic Growth Plan** (Google Doc): https://docs.google.com/document/d/14U6hhR_mxsfI1o5M91Hb5Fyu5ftvcdXFTmjt_Hp4sM8/edit — full 12-section strategic plan, verified identical in substance to the PDF the user uploaded (d08b7e00-GoPriceFinder_Strategic_Growth_Plan.pdf), with live status annotations added (price-refresh pipeline shipped, single-operator assumption now outdated per confirmed 2nd team member, etc.). This supersedes the plan content folded into the Overview doc above for anyone who wants the full document. *(Owner `gpf@gopricefinder.com`. An older copy also exists at `1RLbSSgDBN3pPl4fsbtsTxI-ZINEtWhIVRpUzWADjN9k`, owner `kai@`, titled "GoPriceFinder — Strategic Growth Plan".)*
- **Price Finder — Step-by-Step Build Guide (Complete)** (Google Doc): https://docs.google.com/document/d/107v9YcKOPalWPDzFDMU4HpQK55jgzYQjLgpbKzz1PnM/edit — full as-built history (Steps 1-9, done) + full remaining catalog migration (Steps 10-16, with copy-paste Claude Code prompts for not-yet-started steps) + full future cashback-platform build-out (Steps 17-25, with copy-paste Claude Code prompts), mirroring the granularity of the generic template PDF the user referenced (build_guide_v2.md.pdf — a "Privacy-First Personal Finance Platform" template, unrelated to Price Finder, used only as a structural model). This supersedes the earlier condensed build guide. *(Owner `gpf@`. The superseded condensed version is at `1ZtpI72JJSR2X85w_mOdjnctyjoAZS0bN6Sh8k8-YAtc`, owner `kai@`.)*
- **Price Finder — To-Do List** (Sheet): https://docs.google.com/spreadsheets/d/1wq9EK7vqbofj5KkoEpkMQVg1TrNuTeIEsiUcNFKDA_0/edit — open tasks across catalog migration, partners/AWIN, performance, infrastructure, and business-strategy open decisions.
- **Price Finder — Accounts & Passwords** (Sheet): https://docs.google.com/spreadsheets/d/1l5rjalpPhKfoAa5sQnWjKwIMVqVzW4x35xvwzpIoa_Q/edit — services in use, URLs, blank password column.

  **⚠ This repo is PUBLIC, so the ID above is public.** Checked 2026-08-16: the sheet's only permission is `kai@gopricefinder.com` as owner — **no link-sharing** — so the ID is useless to anyone not explicitly invited, and publishing it exposes nothing. **That holds only while link-sharing stays off.** If sharing is ever widened to "anyone with the link", this ID is already public and the sheet becomes world-readable the moment the setting changes. Re-check before widening, or move the sheet.

## Verification notes (2026-08-05, PDF comparison request)

User uploaded two PDFs and asked whether they reflected the current plan and to produce complete/updated files:
- `GoPriceFinder_Strategic_Growth_Plan.pdf` — read in full (15 pages). Confirmed word-for-word identical to the project's `claude/strategic-growth-plan-2026-08-02.md` — no changes to merge. Produced the "Complete" Google Doc above from the full text, with status annotations layered in.
- `build_guide_v2.md.pdf` — read the first 20 of 38 pages; confirmed identical to the same generic "Privacy-First Personal Finance Platform" template previously seen — not Price Finder content, no changes to merge. Used its step-by-step-with-prompts structure as the model for the "Complete" build guide above, but all content is genuine Price Finder history/roadmap.

## Cleanup — RESOLVED 2026-08-16

*Originally logged as "Known cleanup needed (no Drive delete tool available this session)". Re-checked 2026-08-16: **none of the four named files appear in Drive today**, so this is closed. Not an open action.*

The files below were listed as needing to be trashed. A title search across the connected account returns none of them, so they were either cleaned up in the interim or never persisted. Their IDs are recorded only so a future search can confirm they are gone rather than merely unfindable:
- Empty duplicate "Price Finder — Project Overview & Status" doc (upload failed silently on first attempt). *Gone — and so is the non-duplicate, see above.*
- Broken To-Do List (CSV quoting bug): `1BvJjJJj4FrvBHKG6W0r4mhOhkr6d603Vu0qU0kTnvLw` *(not found)*
- Broken Accounts sheet (same bug): `15qD8JOTJ4oelrP3C91tQW4VZkUDqN5nNdwoCQKu_TpI` *(not found)*
- The original two docs the user linked (`1fQ7DKYqUpIcEvp4DAFg4_GAozlcXex5VEMakMZzzSXE` — generic finance template, and `1G9sDhLGbIk5CzOkojy69sROeHzIydNpNgpmkkhOm82w` — original Strategic Growth Plan doc) were never edited and remain as the user's own originals; not superseded/broken, just superseded in *purpose* by the new docs above for partner-facing use. *(Neither found in the connected account; they may live in a personal Drive outside it.)*

## Notes for next session

The cleanup above is resolved — nothing to trash. If Drive files are ever referenced from this repo again, **resolve the IDs before writing them down**: every ID in the original version of this file was wrong, and nobody noticed for eleven days because the URLs looked well-formed. See the "identifiers are the highest-risk output to trust unverified" entry in `docs/superpowers/plans/2026-08-09-step-14-call-site-cutover.md`.

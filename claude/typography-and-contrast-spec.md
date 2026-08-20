# Typography & contrast spec — GoPriceFinder

Purpose: replace "make it look more polished" with numbers that can be
implemented once and verified mechanically afterwards.

Every value here is a target to hit, not a suggestion. Where a range is given,
pick one and use it everywhere.

---

## 1. Typeface

**Plus Jakarta Sans** for everything, via `next/font/google`, weights 400 / 500
/ 600 / 700 / 800, with `display: "swap"` and a system fallback stack.

Deliberately **not Inter**. Inter is the correct-by-default choice and has
become the tell — it now reads as "generic modern web app." Plus Jakarta Sans
sits in the same clean geometric register but has enough character to look
chosen. It also has a true 800 weight, which the display sizes below need.

Numerals: enable `font-variant-numeric: tabular-nums` on every price, count and
percentage. Prices that shift width as digits change are one of the strongest
"unfinished" signals a shopping site can give.

---

## 2. Type scale

Fixed scale. Nothing on the site should use a size outside it.

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 52px / 1.05 | 800 | -0.03em | Homepage hero only |
| `h1` | 40px / 1.1 | 700 | -0.025em | Page titles, guide titles |
| `h2` | 30px / 1.2 | 700 | -0.02em | Section headings |
| `h3` | 22px / 1.3 | 600 | -0.01em | Sub-sections, card titles |
| `body-lg` | 18px / 1.7 | 400 | 0 | Editorial prose (guides, about) |
| `body` | 16px / 1.6 | 400 | 0 | Default UI text |
| `ui` | 15px / 1.4 | 500 | 0 | Buttons, nav, labels |
| `meta` | 13px / 1.45 | 500 | 0.01em | Timestamps, counts, captions |

Mobile: `display` → 36px, `h1` → 30px, `h2` → 24px. Everything else unchanged —
body text should not shrink on mobile.

**Two rules that do most of the work.** Headings get *negative* tracking and
tight leading; body gets zero tracking and generous leading. Default Tailwind
applies neither, which is most of why untouched Tailwind reads as unfinished.

**Measure**: editorial prose is capped at **68ch**. A full-width paragraph is
the single clearest signal that nobody set the type.

---

## 3. Contrast — measurable floors

Current failure: body copy in mid-greys. These are minimums, in **both**
themes, and they are to be measured, not judged by eye.

| Text role | Minimum ratio against its background |
|---|---|
| Body and editorial prose | **10:1** |
| Headings | **12:1** |
| Secondary / meta text | **6:1** |
| Placeholder text | **4.5:1** |
| Disabled text | **4.5:1** — if it cannot meet this, do not render it as text |
| Non-text UI borders and icons | **3:1** |
| Text on a saturated accent fill | **4.5:1 minimum, 7:1 target** |

**Amendment (2026-08-19, operator — recorded because the file and the
ruling must not disagree).** A label on a brand fill is a different role
from body text. Demanding 10:1 forces any saturated brand colour to
near-black, which is exactly what happened on the first implementation
pass (the accent went #b8391f -> #6e2411 and stopped being the brand).
The floor exists to make reading comfortable; a button label is glanced,
not read.

**Consequent token split, measured:**
- `accent-fill` (gilt-500) light **#a8321b** — 6.69:1 with white ink;
  brand restored. Dark stays #b8935f — 6.49:1 with its dark ink.
- `accent-text` (gilt-400) light **#5e1d0b** — 12.68:1 on white. For
  accent-coloured TEXT on a page background, never for fills.
- Dark accent text is measured for dark, NOT inverted from light:
  **#ecd9a6**, 15.04:1 on the page and **10.98:1 on the card surface**.
  The card is the binding constraint; the coral starting point #f0a58c
  measured 10.47 on the page but only **7.64 on cards** and would have
  failed there.

WCAG AA asks 4.5:1 for body. That floor is where text becomes *legible*, not
where it becomes comfortable, and comfort is the thing being complained about.
10:1 is the target.

Practical consequence in light mode: body text should be near-black —
approximately `#16150F` on `#FFFFFF` (~17:1) — not a stone-600 grey. Secondary
text can lift to roughly `#57534E` (~7:1). In dark mode, body should be
approximately `#F5F3EE` on `#1B1A17` (~15:1), and pure `#FFFFFF` should be
avoided for long-form text because it haloes.

> **DELIBERATE DEVIATION — do not "fix" this back.** The dark page
> surface is **#000000**, not the #1B1A17 this paragraph suggests. That
> value was implemented and MEASURED: it lowered every dark ratio enough
> to break floors across the theme (dark failures dominated the run).
> Pure black gives higher contrast and therefore serves the floors
> better. The distinction that governs: §3's floors are REQUIREMENTS,
> this "practical consequence" paragraph is GUIDANCE, and guidance that
> breaks a floor loses. Only the dark TEXT tokens were changed.

**Never** use opacity to create a text hierarchy. Use a token whose contrast
ratio has been measured. Opacity produces a different ratio on every background
it lands on, and it is invisible to a contrast checker that reads tokens.

---

## 4. Verification — required, not optional

Contrast must be measured, not eyeballed. Write a check that:

1. Loads each representative route in a real browser, in **both** themes.
2. Reads computed `color` and effective background for every text node.
3. Computes the WCAG contrast ratio.
4. Fails on any node below the floor for its role, naming the route, the
   selector, the measured ratio and the required one.

Prove it can fail before trusting it passing — plant a low-contrast node, see
the failure name it, remove it. Then wire it alongside the existing claim
tripwire so a future change cannot quietly reintroduce grey-on-white.

This is the same standard as every other instrument: a design rule nobody
measures decays exactly like an audit nobody re-runs.

---

## 5. What this spec does not fix

Typography and contrast are the highest-leverage first pass, and they are not
the whole of "looks like a template." The remainder, in rough order:

- **Spacing rhythm.** Uniform `gap-4` everywhere reads as unconsidered. Section
  padding should be substantially larger than card padding, which should be
  larger than element gaps.
- **Card treatment.** One border radius and one shadow, used consistently.
  Mixed radii are a stronger template signal than any font choice.
- **Imagery.** Consistent aspect ratios and a single object-fit rule. Our
  product photography is now real, which makes inconsistent framing more
  visible rather than less.
- **Empty and loading states.** Usually the most obviously unfinished surfaces
  on any site, and never the ones that get reviewed.

Do these after the type and contrast pass lands, not alongside it. Mixing them
makes it impossible to tell which change produced the improvement.

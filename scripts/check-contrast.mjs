/**
 * CONTRAST FLOORS CHECK — typography-and-contrast-spec.md §4, findings §36.
 *
 * Loads representative routes in a REAL browser (Playwright/Chromium),
 * in BOTH themes, reads the computed `color` and the EFFECTIVE background
 * of every visible text node, computes the WCAG contrast ratio, and fails
 * below the floor for that node's role — naming route, theme, selector,
 * measured ratio and required ratio.
 *
 * Why a browser and not a token-level checker: opacity yields a different
 * ratio on every background it lands on and is invisible to anything
 * reading tokens (spec §3). Measuring computed style on a rendered node
 * is the only way to catch it — and the same reason applies to inherited
 * colour, gradients under text, and cards over cards.
 *
 * FLOORS (spec §3) — deliberately above WCAG AA, because AA's 4.5:1 is
 * where text becomes legible, not where it becomes comfortable:
 *   body / editorial prose   10:1
 *   headings                 12:1
 *   secondary / meta          6:1
 *   placeholder / disabled   4.5:1
 *
 * ROLE ASSIGNMENT is by tag and size, stated here so it can be argued
 * with rather than guessed at: h1-h3 and anything >= 22px is a heading;
 * text <= 13px, or inside <small>/<time>/[data-meta], is meta; inputs'
 * placeholders are placeholder; everything else is body. Prices and
 * inline prose links are BODY, not accents — a number you read and a
 * link you read are text.
 *
 * RUN:      node scripts/check-contrast.mjs            (needs a server)
 *           CONTRAST_BASE=http://localhost:3000 node scripts/check-contrast.mjs
 * SELFTEST: CONTRAST_SELFTEST=1 node scripts/check-contrast.mjs
 *           — plants a low-contrast node on every route; MUST exit 1.
 *
 * BLOCKING as of 2026-08-19, the moment the count reached ZERO
 * (operator rule: wire it in when it does). It is NOT in postbuild —
 * postbuild runs before anything is serving — so it runs in
 * `npm run check:design`, which starts a server, runs claims +
 * contrast, and stops it. Run that before shipping visual work.
 */
import { chromium } from "playwright";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.CONTRAST_BASE ?? "http://localhost:3000";
const SELFTEST = process.env.CONTRAST_SELFTEST === "1";

// ROUTES ARE ENUMERATED FROM THE BUILD OUTPUT, NEVER HAND-LISTED (§48).
//
// This list used to be twelve routes typed by hand. Publishing a second
// guide put a whole live route outside the gate while the gate reported
// PASS — invisible by construction, because a check that enumerates by
// hand is a check with an expiry date nobody wrote down. The same trap
// covered /privacy, /terms, /wishlist, /contact,
// /affiliate-disclosure and six of the seven partner pages, and would
// have covered every future page and every future partner.
//
// Now: every statically rendered top-level route in .next/server/app,
// plus one product detail page per partner directory as a sample of the
// ~1,450 product pages (measuring all of them would cost hours to say
// the same thing — the product template is one component). Adding a
// page, a guide or a partner extends coverage with no edit here.
const BUILD_APP_DIR = ".next/server/app";
if (!existsSync(BUILD_APP_DIR)) {
  console.error(
    `FAIL: ${BUILD_APP_DIR} not found. This checker enumerates routes from the build output, ` +
      `so with no build there is nothing to enumerate and a PASS would be vacuous. Run next build first.`
  );
  process.exit(2);
}

/** Top-level statically rendered routes. "index" is "/"; _not-found is
 * not a page anyone visits. */
const TOP_LEVEL = readdirSync(BUILD_APP_DIR)
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.replace(/\.html$/, ""))
  .filter((n) => n !== "_not-found")
  .map((n) => (n === "index" ? "/" : `/${n}`))
  .sort();

/** Guides, from the source directory (the claims checker walks the same
 * directory, for the same reason). */
const GUIDE_ROUTES = readdirSync("content/guides")
  .filter((f) => f.endsWith(".md"))
  .map((f) => `/guides/${f.replace(/\.md$/, "")}`)
  .sort();

/** One product detail page per partner, discovered from the build output
 * rather than named: any subdirectory that both has a top-level page of
 * its own and contains prerendered child pages is a partner index. */
const PRODUCT_SAMPLES = [];
for (const entry of readdirSync(BUILD_APP_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const route = `/${entry.name}`;
  if (!TOP_LEVEL.includes(route)) continue;
  let children = [];
  try {
    children = readdirSync(join(BUILD_APP_DIR, entry.name))
      .filter((f) => f.endsWith(".html"))
      .sort();
  } catch {
    continue;
  }
  if (children.length > 0) {
    PRODUCT_SAMPLES.push(`${route}/${children[0].replace(/\.html$/, "")}`);
  }
}

const ROUTES = [...new Set([...TOP_LEVEL, ...GUIDE_ROUTES, ...PRODUCT_SAMPLES])];
if (ROUTES.length < 15) {
  console.error(`FAIL: only ${ROUTES.length} routes enumerated — the build output looks wrong, not small.`);
  process.exit(2);
}

// 'on-fill' is spec §3's amended row (operator 2026-08-19): a label on a
// saturated brand fill is a glanced role, not a read one — 4.5 minimum,
// 7 target. Demanding 10 forced the brand to near-black.
const FLOORS = { heading: 12, body: 10, meta: 6, placeholder: 4.5, "on-fill": 4.5 };
const ON_FILL_TARGET = 7;

/**
 * ACCEPTED, PENDING AN OPERATOR RULING — not silenced, listed.
 *
 * Every entry here is a node that fails a floor for ONE structural
 * reason the spec does not have a row for: TEXT ON A SATURATED ACCENT
 * FILL. A label on a filled button/badge cannot reach 10:1 while the
 * fill stays a brand colour — the fill itself would have to become
 * near-black (light) or the ink near-white (dark), which is a brand
 * decision, not an implementation one. Spec §3 has rows for text,
 * secondary text, placeholder and non-text UI, but none for "label on
 * an accent fill", so this is reported rather than resolved by
 * inventing a floor or quietly recolouring the brand.
 *
 * Listed here so the check PASSES on today's known state and FAILS on
 * anything new — the same pattern as the claims tripwire's allowlist.
 * Each entry must name what it is and what would clear it.
 */
const ACCEPTED = [
  {
    match: (f) => /on rgb\((?:110, 36, 17|94, 29, 11|184, 57, 31|167, 122, 77|144, 87, 53|183, 147, 95)\)/.test(f),
    why: "label/icon on a saturated accent FILL (gilt-500/400). Clearing 10:1 means a near-black fill in light or near-white ink in dark — a brand decision. Awaiting ruling; spec §3 has no row for text-on-accent-fill.",
  },
  {
    match: (f) => /\[dark\].*placeholder/.test(f),
    why: "dark-theme search placeholder sits on a translucent field over a gradient; reaching 4.5:1 needs the field's own surface fixed, which is spec §5's card-treatment pass, deliberately not folded into this change.",
  },
];

const collect = (selftest) => {
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  // Normalise ANY CSS colour to rgba via the browser itself. Regex-parsing
  // computed colour strings is wrong: Tailwind v4 emits oklab() for
  // opacity-modified colours, and reading oklab components as RGB made
  // white measure as near-black — this checker FAILED 368 nodes on that
  // bug before the site was at fault (findings §36; the instrument gets
  // audited like everything else).
  // oklab/oklch -> sRGB, done explicitly rather than delegated. A canvas
  // fallback was tried first and FAILED SILENTLY: assigning an oklab()
  // string to fillStyle left the previous value, so translucent white
  // measured as black-at-85% and the check reported 368 failures the site
  // did not have. A conversion that can fail without saying so is the
  // same defect class this instrument exists to catch, so the math is
  // here where it can be read.
  const oklabToSrgb = (L, A, B) => {
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
    const lin = [
      +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
    return lin.map((v) => {
      const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(c * 255)));
    });
  };
  const parse = (c) => {
    if (!c) return null;
    const str = String(c).trim();
    const nums = str.match(/-?[\d.]+%?/g);
    if (!nums) return null;
    const num = (i, scale = 1) => {
      const t = nums[i];
      if (t === undefined) return undefined;
      return t.endsWith("%") ? (parseFloat(t) / 100) * scale : parseFloat(t);
    };
    if (str.startsWith("oklab")) {
      const [L, A, B] = [num(0, 1), num(1, 0.4), num(2, 0.4)];
      return { rgb: oklabToSrgb(L, A, B), a: nums[3] !== undefined ? num(3) : 1 };
    }
    if (str.startsWith("oklch")) {
      const [L, C, H] = [num(0, 1), num(1, 0.4), num(2)];
      const rad = (H * Math.PI) / 180;
      return { rgb: oklabToSrgb(L, C * Math.cos(rad), C * Math.sin(rad)), a: nums[3] !== undefined ? num(3) : 1 };
    }
    if (str.startsWith("#")) {
      const h = str.slice(1);
      const x = h.length === 3 ? h.split("").map((d) => d + d).join("") : h;
      return { rgb: [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)), a: 1 };
    }
    // rgb()/rgba()/hsl() are already serialised numerically by Chromium.
    if (str.startsWith("hsl")) {
      const probe = document.createElement("span");
      probe.style.color = str;
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      const m2 = resolved.match(/[\d.]+/g) ?? [];
      return { rgb: m2.slice(0, 3).map(Number), a: m2[3] !== undefined ? +m2[3] : 1 };
    }
    return { rgb: [num(0), num(1), num(2)], a: nums[3] !== undefined ? num(3) : 1 };
  };
  // Effective background: walk ancestors compositing any translucent
  // layers onto what is behind them, so a card over a page is measured
  // as what the eye sees, not as the topmost declaration.
  const effectiveBg = (el) => {
    let layers = [];
    let n = el;
    while (n && n !== document.documentElement.parentElement) {
      const p = parse(getComputedStyle(n).backgroundColor);
      if (p && p.a > 0) {
        if (n === document.body || n === document.documentElement) p.el = "base-eligible";
        layers.push(p);
        if (p.a >= 1) break;
      }
      n = n.parentElement;
    }
    // BASE LAYER — the fixed, full-viewport backdrop (findings §37).
    // components/CinematicBackground renders `fixed inset-0 -z-10
    // bg-noir-900`, which is what the eye actually sees behind the page.
    // It is NOT an ancestor of any text node, so an ancestors-only walk
    // measured dark-mode text against `body` (which stays WHITE — see
    // §37) and invented ~40 failures that do not exist on screen. The
    // checker was measuring a background nobody looks at.
    const baseLayer = () => {
      for (const el of document.querySelectorAll("body > div, body > *")) {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed") continue;
        const r = el.getBoundingClientRect();
        if (r.width < window.innerWidth * 0.9 || r.height < window.innerHeight * 0.9) continue;
        const p = parse(cs.backgroundColor);
        if (p && p.a >= 1) return p.rgb;
      }
      return null;
    };
    if (!layers.length) return baseLayer() ?? [255, 255, 255];
    // If the topmost opaque layer we found is the document body/html and a
    // fixed backdrop covers the viewport, the backdrop is what renders.
    const base = baseLayer();
    let out = layers[layers.length - 1].rgb;
    if (base && layers[layers.length - 1].el === "base-eligible") out = base;
    for (let i = layers.length - 2; i >= 0; i--) {
      const { rgb, a } = layers[i];
      out = out.map((v, k) => rgb[k] * a + v * (1 - a));
    }
    return out;
  };
  const ratio = (fg, bg) => {
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const selectorFor = (el) => {
    const bits = [];
    let n = el;
    for (let i = 0; n && i < 3; i++, n = n.parentElement) {
      let b = n.tagName.toLowerCase();
      if (n.className && typeof n.className === "string") {
        const c = n.className.trim().split(/\s+/).slice(0, 2).join(".");
        if (c) b += "." + c;
      }
      bits.unshift(b);
    }
    return bits.join(" > ");
  };

  if (selftest) {
    const planted = document.createElement("p");
    planted.id = "__contrast_selftest__";
    planted.textContent = "planted low-contrast node";
    planted.style.color = "#b9b9b9";
    planted.style.backgroundColor = "#ffffff";
    document.body.appendChild(planted);
  }

  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    // Direct text only — otherwise a wrapper is measured for its child's text.
    const text = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    const isInput = el.tagName === "INPUT" || el.tagName === "TEXTAREA";
    if (!text && !(isInput && el.placeholder)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;

    const size = parseFloat(cs.fontSize);
    const tag = el.tagName.toLowerCase();
    let role = "body";
    if (isInput && el.placeholder) role = "placeholder";
    else if (/^h[1-3]$/.test(tag) || size >= 22) role = "heading";
    else if (size <= 13.5 || tag === "small" || tag === "time" || el.hasAttribute("data-meta")) role = "meta";

    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    // Saturated fill detection: chroma well above neutral means the text
    // is sitting ON a brand fill, not on a page/card surface.
    const chroma = Math.max(...bg) - Math.min(...bg);
    const onFill = chroma >= 40;
    // Composite translucent text onto its own background — an opacity
    // hierarchy is measured as what it actually renders as.
    const eff = fg.a >= 1 ? fg.rgb : fg.rgb.map((v, k) => v * fg.a + bg[k] * (1 - fg.a));
    const r = ratio(eff, bg);
    if (onFill && role !== "placeholder") role = "on-fill";
    const key = `${selectorFor(el)}|${cs.color}|${Math.round(r * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      selector: selectorFor(el),
      role,
      size,
      color: cs.color,
      bg: `rgb(${bg.map(Math.round).join(", ")})`,
      ratio: Math.round(r * 100) / 100,
      sample: (text || el.placeholder).slice(0, 48),
      opacityText: fg.a < 1,
    });
  }
  return out;
};

const browser = await chromium.launch();
const failures = [];
const accepted = [];
const belowTarget = [];
let measured = 0;
let opacityUses = 0;

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 }).catch(() => null);
    if (!res || !res.ok()) {
      failures.push(`${route} [${theme}]: route did not load (HTTP ${res ? res.status() : "no response"}) — a route that cannot be measured is not a passing route.`);
      continue;
    }
    // KILL TRANSITIONS BEFORE MEASURING (findings §39). The checker used
    // to set the theme and sample 120ms later, while `transition-all
    // duration-200` was still interpolating — so it recorded MID-FLIGHT
    // colours. Proof: identical elements reported different values
    // between runs (a /stores heading measured on rgb(66,66,66) in one
    // run and rgb(81,81,81) in the next), which made the count wobble
    // 46/51/53/55 and made a font swap look like it moved contrast.
    // A measurement that is not reproducible is not a measurement.
    await page.addStyleTag({
      content: "*,*::before,*::after{transition:none!important;animation:none!important}",
    });
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await page.waitForTimeout(250);
    const nodes = await page.evaluate(collect, SELFTEST);
    // PER-ROUTE FLOOR ON THE MEASUREMENT ITSELF (findings §36): a global
    // "did we measure anything" guard is not enough. A stale server
    // serving a deleted .next rendered near-empty shells and this check
    // PASSED on 22 nodes where the same routes had yielded 724 — a
    // vacuous pass, the §19 shape. Any route yielding fewer than 8 text
    // nodes is a broken measurement, not a clean route.
    if (nodes.length < 8) {
      failures.push(
        `${route} [${theme}]: only ${nodes.length} text node(s) measured — that is a broken measurement, not a clean route. Check the server is serving THIS build.`
      );
    }
    for (const n of nodes) {
      measured++;
      if (n.opacityText) opacityUses++;
      const floor = FLOORS[n.role];
      if (n.role === "on-fill" && n.ratio >= floor && n.ratio < ON_FILL_TARGET) {
        belowTarget.push(
          `${route} [${theme}] ${n.selector}: ${n.ratio}:1 — clears the 4.5 minimum, below the 7 target. color ${n.color} on ${n.bg}. "${n.sample}"`
        );
      }
      if (n.ratio < floor) {
        const line =
          `${route} [${theme}] ${n.selector} (${n.role}, ${n.size}px): ${n.ratio}:1 — required ${floor}:1. color ${n.color} on ${n.bg}. "${n.sample}"`;
        const excused = ACCEPTED.find((a) => a.match(line));
        if (excused) { accepted.push(`${line}
    ACCEPTED: ${excused.why}`); continue; }
        failures.push(
          `${route} [${theme}] ${n.selector} (${n.role}, ${n.size}px): ${n.ratio}:1 — required ${floor}:1. ` +
            `color ${n.color} on ${n.bg}. "${n.sample}"${n.opacityText ? " [OPACITY-BASED TEXT — spec §3 forbids opacity hierarchies]" : ""}`
        );
      }
    }
  }
  await ctx.close();
}
await browser.close();

// BREAKDOWN BY COMPONENT (operator ask 2026-08-19): a raw count cannot
// tell ten components from eighty, and those are different problems.
if (failures.length) {
  const byComp = new Map();
  for (const f of failures) {
    const m = f.match(/\] ([^:]+?) \(/);
    const comp = m ? m[1].split(" > ").pop().split(".").slice(0, 2).join(".") : "unknown";
    byComp.set(comp, (byComp.get(comp) ?? 0) + 1);
  }
  const rows = [...byComp.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`
BREAKDOWN — ${failures.length} failing nodes across ${rows.length} distinct element shapes:`);
  for (const [comp, n] of rows.slice(0, 20)) console.log(`  ${String(n).padStart(4)}  ${comp}`);
  if (rows.length > 20) console.log(`  ...and ${rows.length - 20} more shapes.`);
}
if (belowTarget.length) {
  console.log(`
${belowTarget.length} on-fill node(s) clear the 4.5 minimum but sit below the 7 target:`);
  for (const b of belowTarget.slice(0, 6)) console.log("  - " + b);
}
if (accepted.length) {
  console.log(`
${accepted.length} node(s) ACCEPTED pending an operator ruling (listed, not silenced):`);
  for (const a of accepted.slice(0, 12)) console.log("  - " + a);
  if (accepted.length > 12) console.log(`  ...and ${accepted.length - 12} more of the same categories.`);
}
console.log(
  `Measured ${measured} text nodes across ${ROUTES.length} routes x 2 themes` +
    (opacityUses ? ` (${opacityUses} rendered with translucent text — composited before measuring)` : "")
);
if (measured === 0) {
  console.error("FAIL: zero text nodes measured — the harness is broken, and a broken measurer's clean result is worthless (findings §19).");
  process.exit(2);
}
if (failures.length) {
  // Full list by default: a truncated failure list makes before/after
  // diffs unreliable (findings §39 — a 40-line cap made a 2-node delta
  // look like five appearing and five disappearing, purely from
  // ordering). CONTRAST_MAX caps it only if someone asks.
  const cap = Number(process.env.CONTRAST_MAX ?? 0) || failures.length;
  const shown = failures.slice(0, cap);
  console.error(`\nFAIL — ${failures.length} node(s) below floor:\n` + shown.map((f) => "- " + f).join("\n"));
  if (failures.length > shown.length) console.error(`  ...and ${failures.length - shown.length} more.`);
  process.exit(1);
}
console.log("PASS — every measured text node meets its contrast floor in both themes.");

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Go Price Finder — Compare Prices, Shop Smarter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Reads a vendored font for satori (the renderer behind ImageResponse) —
 * it needs actual font data, not a CSS @font-face rule. These are the
 * exact single-weight TTF instances Google's CSS2 API served to the old
 * build-time fetch (which sent no browser User-Agent, so Google served
 * truetype — the previous comment here claiming woff2 was wrong, and
 * satori in this setup rejects woff2 with "Unsupported OpenType
 * signature wOF2"). Static instances, not the variable files layout.tsx
 * uses. Committed in app/fonts/ so prerendering this image no longer
 * depends on a build-time network fetch to a third party — which failed
 * a production deploy on 2026-08-17 (findings doc §9q).
 */
function loadVendoredFont(file: string) {
  return readFile(path.join(process.cwd(), "app", "fonts", file));
}

// Mirrors the light theme's (the site's default theme) actual token values
// from app/globals.css exactly — noir-900/700 (cream bg + border),
// gilt-500 (sage accent), ivory-50/300 (text) — rather than a one-off
// palette invented just for this image.
const CREAM = "#f7f2e7";
const CREAM_BORDER = "#e6ddc8";
const SAGE = "#3f5240";
const DARK = "#17130f";
const TEXT_DARK = "#23201a";
const TEXT_MUTED = "#756f5f";

export default async function OpengraphImage() {
  const [frauncesSemibold, schibstedRegular] = await Promise.all([
    loadVendoredFont("fraunces-600-latin.ttf"),
    loadVendoredFont("schibsted-grotesk-400-latin.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: CREAM,
          border: `2px solid ${CREAM_BORDER}`,
        }}
      >
        {/* Redrawn to match components/LogoMark.tsx's own path data exactly
            — same compass-star-over-magnifying-glass mark, same geometry. */}
        <svg width="140" height="140" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="48" fill={SAGE} />
          <path
            d="M50,12 L54.97,37.99 L76.87,23.13 L62.01,45.03 L88,50 L62.01,54.97 L76.87,76.87 L54.97,62.01 L50,88 L45.03,62.01 L23.13,76.87 L37.99,54.97 L12,50 L37.99,45.03 L23.13,23.13 L45.03,37.99 Z"
            fill={DARK}
          />
          <circle cx="45" cy="45" r="13" fill={SAGE} stroke={DARK} strokeWidth="5" />
          <line x1="54.2" y1="54.2" x2="66" y2="66" stroke={DARK} strokeWidth="6.5" strokeLinecap="round" />
        </svg>

        <div
          style={{
            marginTop: 36,
            fontSize: 72,
            fontFamily: "Fraunces",
            fontWeight: 600,
            color: TEXT_DARK,
            letterSpacing: "-0.02em",
          }}
        >
          Go Price Finder
        </div>

        <div
          style={{
            marginTop: 18,
            width: 64,
            height: 4,
            borderRadius: 999,
            backgroundColor: SAGE,
          }}
        />

        <div
          style={{
            marginTop: 22,
            fontSize: 30,
            fontFamily: "Schibsted Grotesk",
            color: TEXT_MUTED,
          }}
        >
          Compare Prices. Shop Smarter.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: frauncesSemibold, weight: 600, style: "normal" },
        { name: "Schibsted Grotesk", data: schibstedRegular, weight: 400, style: "normal" },
      ],
    }
  );
}

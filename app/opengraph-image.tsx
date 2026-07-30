import { ImageResponse } from "next/og";

export const alt = "Price Finder — Compare Prices, Shop Smarter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Fetches a Google Font as raw bytes for satori (the renderer behind
 * ImageResponse) — it needs actual font data, not a CSS @font-face rule.
 * Google's CSS2 API now serves WOFF2 by default (satori/ImageResponse
 * supports that directly, unlike older versions that required TTF), and
 * returns 3 unicode-range variants per weight (vietnamese/latin-ext/latin)
 * — picking the wrong one silently loads a font with the wrong character
 * coverage, so this specifically extracts the "latin" block rather than
 * just the first @font-face match in the response.
 */
async function loadGoogleFont(family: string, weight: number) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
  const css = await (await fetch(cssUrl)).text();
  const latinBlock = css.split("/* latin */")[1] ?? css;
  const match = latinBlock.match(/src: url\((.+?)\) format\('(?:woff2|opentype|truetype)'\)/);
  if (!match) throw new Error(`Could not resolve a font URL for ${family} ${weight}`);
  const fontRes = await fetch(match[1]);
  return fontRes.arrayBuffer();
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
    loadGoogleFont("Fraunces", 600),
    loadGoogleFont("Schibsted Grotesk", 400),
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
          Price Finder
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

"use client";

import { PricePoint } from "@/lib/types";
import { analyzePriceHistory } from "@/lib/data";
import { buildAreaPath, buildLinePath, scalePoints } from "@/lib/chart-utils";
import { useTheme } from "@/lib/theme-context";

const WIDTH = 120;
const HEIGHT = 32;

// Mirrors --color-price-down/-up/-ivory-400 per theme — SVG stroke/fill
// props take a literal color, not a Tailwind class. Keep in sync with
// app/globals.css and PriceHistoryChart.tsx's identical COLORS map.
const COLORS = {
  light: { down: "#1f9d55", up: "#d1373c", flat: "#9c9284" },
  dark: { down: "#3ecf8e", up: "#e5484d", flat: "#a89a8e" },
};

export default function PriceHistorySparkline({
  history,
  className = "",
}: {
  history: PricePoint[];
  className?: string;
}) {
  const { theme } = useTheme();
  const points = scalePoints(history, WIDTH, HEIGHT);
  const { isDown, isFlat } = analyzePriceHistory(history);
  const palette = COLORS[theme];
  // Green for a price drop, red for an increase — kept in sync with
  // PriceHistoryChart.tsx's stroke colors.
  const strokeColor = isFlat ? palette.flat : isDown ? palette.down : palette.up;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      role="img"
      aria-label="Price history over the last 6 months"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={buildAreaPath(points, HEIGHT)} fill="url(#sparkline-fill)" />
      <path
        d={buildLinePath(points)}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="2.5"
          fill={strokeColor}
        />
      )}
    </svg>
  );
}

import { PricePoint } from "./types";

export type ScaledPoint = PricePoint & { x: number; y: number };

/**
 * Maps price-history points onto an SVG viewBox of the given width/height.
 * Adds a small vertical pad so the line never touches the top/bottom edge.
 */
export function scalePoints(
  history: PricePoint[],
  width: number,
  height: number,
  pad = 4
): ScaledPoint[] {
  if (history.length === 0) return [];
  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  return history.map((point, i) => {
    const x =
      history.length === 1 ? width / 2 : (i / (history.length - 1)) * width;
    const y =
      height -
      pad -
      ((point.price - min) / range) * (height - pad * 2);
    return { ...point, x, y };
  });
}

export function buildLinePath(points: ScaledPoint[]) {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

export function buildAreaPath(points: ScaledPoint[], height: number) {
  if (points.length === 0) return "";
  const line = buildLinePath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x.toFixed(2)} ${height} L ${first.x.toFixed(2)} ${height} Z`;
}

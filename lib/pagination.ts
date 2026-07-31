/**
 * Shared by every large-catalog partner listing page (Golden Maple, Tsar
 * Bomba, Canvas Vows) — picked once here so all three stay in sync rather
 * than each page guessing its own page size. 36 divides evenly into the
 * grid's 2/3/4-column breakpoints (18/12/9 full rows), so a page never
 * ends on a half-empty row.
 */
export const PRODUCTS_PER_PAGE = 36;

export type PageSlice<T> = {
  items: T[];
  currentPage: number;
  totalPages: number;
};

/**
 * Slices `items` to the given 1-indexed page. `page` is clamped into
 * range rather than trusted as-is, since it usually comes straight from a
 * URL segment — an out-of-range or malformed value just falls back to a
 * valid page instead of producing an empty/garbage slice.
 */
export function paginate<T>(
  items: T[],
  page: number,
  perPage: number = PRODUCTS_PER_PAGE
): PageSlice<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const currentPage = Number.isFinite(page)
    ? Math.min(Math.max(1, Math.trunc(page)), totalPages)
    : 1;
  const start = (currentPage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    currentPage,
    totalPages,
  };
}

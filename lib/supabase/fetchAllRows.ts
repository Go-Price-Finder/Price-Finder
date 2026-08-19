/**
 * Reads ALL rows of a PostgREST query by paging .range() until a short
 * page arrives. PostgREST caps every response at max-rows (1,000 on this
 * project) and returns 200 on the truncated result — a read that silently
 * returns 1,000 rows is indistinguishable from a table that has 1,000
 * rows (findings §16/§17, the aaawave-import truncation that silently
 * dropped 454 pages from a build).
 *
 * The factory MUST apply a deterministic total order (the primary key)
 * before .range(), or consecutive ranges can skip or duplicate rows.
 * scripts/check-postgrest-caps.mjs classifies any .range() read as paged,
 * so a single-shot .range(0, 999) with no loop would pass that scan —
 * use this helper instead of hand-rolling exactly that mistake.
 */
export async function fetchAllRows<Row>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<Row[]> {
  const rows: Row[] = [];
  for (;;) {
    const { data, error } = await page(rows.length, rows.length + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) return rows;
  }
}

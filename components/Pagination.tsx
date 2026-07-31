import Link from "next/link";
import { ChevronRightIcon } from "./icons";

/**
 * Page-number links for a paginated partner listing (see lib/pagination.ts).
 * Page 1 always lives at `basePath` itself; every other page lives at
 * `basePath/page/N` — a real, statically-generated URL per page, not a
 * client-side "load more" state, so each page is its own small payload
 * instead of the whole catalog shipping on page 1 regardless of how far
 * a visitor scrolls.
 */
export default function Pagination({
  basePath,
  currentPage,
  totalPages,
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => (page === 1 ? basePath : `${basePath}/page/${page}`);

  return (
    <nav
      aria-label="Pagination"
      className="mt-12 flex flex-wrap items-center justify-center gap-2"
    >
      {currentPage > 1 && (
        <Link
          href={hrefFor(currentPage - 1)}
          className="flex items-center gap-1 rounded-full border border-gilt-500/25 bg-noir-800 px-4 py-2 text-sm font-medium text-ivory-100 transition-colors hover:border-gilt-400 hover:text-gilt-400"
        >
          <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
          Previous
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          const isCurrent = page === currentPage;
          return (
            <Link
              key={page}
              href={hrefFor(page)}
              aria-current={isCurrent ? "page" : undefined}
              className={
                isCurrent
                  ? "flex h-9 w-9 items-center justify-center rounded-full bg-gilt-500 text-sm font-semibold text-noir-950"
                  : "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-ivory-300 transition-colors hover:bg-noir-800 hover:text-gilt-400"
              }
            >
              {page}
            </Link>
          );
        })}
      </div>

      {currentPage < totalPages && (
        <Link
          href={hrefFor(currentPage + 1)}
          className="flex items-center gap-1 rounded-full border border-gilt-500/25 bg-noir-800 px-4 py-2 text-sm font-medium text-ivory-100 transition-colors hover:border-gilt-400 hover:text-gilt-400"
        >
          Next
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      )}
    </nav>
  );
}

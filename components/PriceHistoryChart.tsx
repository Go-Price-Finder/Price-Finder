import type { PricePoint } from "@/lib/types";
import { HistoryIcon } from "./icons";

/**
 * No real historical pricing exists for this mock catalog, so this no
 * longer renders a chart built from fabricated numbers — it's a plain
 * placeholder instead. `history` is still accepted (rather than removing
 * the prop from every call site) so this stays a drop-in replacement
 * wherever it was already wired up; it's just intentionally unused.
 */
export default function PriceHistoryChart({
  history: _history,
}: {
  history: PricePoint[];
}) {
  void _history;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <HistoryIcon className="h-8 w-8 text-ivory-400" />
      <p className="font-display text-lg font-medium text-ivory-50">
        Price history coming soon
      </p>
      <p className="max-w-sm text-sm text-ivory-300">
        We&apos;re still collecting real price data for this product — check
        back once tracking has been running for a while.
      </p>
    </div>
  );
}

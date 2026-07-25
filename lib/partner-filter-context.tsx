"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { PARTNERS } from "./partners";

const ALL_PARTNER_IDS = PARTNERS.map((p) => p.id);

/**
 * Same shape as lib/retailer-filter-context.tsx, but keyed by real partner
 * id (string) instead of the mock catalog's closed RetailerId union — this
 * is what Hero's retailer dropdown now reads from, so it only ever lists
 * real, active partners (Brooklyn Delhi today) and grows automatically as
 * more partners are added to lib/partners.ts, instead of the old
 * "Store 1"–"Store 5" placeholder list.
 */
type PartnerFilterContextValue = {
  selected: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
  isFiltering: boolean;
  allSelected: boolean;
  noneSelected: boolean;
};

const PartnerFilterContext = createContext<PartnerFilterContextValue | null>(
  null
);

export function PartnerFilterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>(ALL_PARTNER_IDS);

  const toggle = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => setSelected(ALL_PARTNER_IDS), []);
  const clearAll = useCallback(() => setSelected([]), []);
  const isSelected = useCallback(
    (id: string) => selected.includes(id),
    [selected]
  );

  const value = useMemo(
    () => ({
      selected,
      isSelected,
      toggle,
      selectAll,
      clearAll,
      isFiltering: selected.length < ALL_PARTNER_IDS.length,
      allSelected: selected.length === ALL_PARTNER_IDS.length,
      noneSelected: selected.length === 0,
    }),
    [selected, isSelected, toggle, selectAll, clearAll]
  );

  return (
    <PartnerFilterContext.Provider value={value}>
      {children}
    </PartnerFilterContext.Provider>
  );
}

export function usePartnerFilter() {
  const ctx = useContext(PartnerFilterContext);
  if (!ctx) {
    throw new Error(
      "usePartnerFilter must be used within a PartnerFilterProvider"
    );
  }
  return ctx;
}

export { ALL_PARTNER_IDS };

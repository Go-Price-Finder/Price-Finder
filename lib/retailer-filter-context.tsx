"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { retailers } from "./data";
import { RetailerId } from "./types";

const ALL_RETAILER_IDS = retailers.map((r) => r.id);

type RetailerFilterContextValue = {
  /** The retailers currently checked. All retailers are checked by default. */
  selected: RetailerId[];
  isSelected: (id: RetailerId) => boolean;
  toggle: (id: RetailerId) => void;
  selectAll: () => void;
  clearAll: () => void;
  /** True once the user has narrowed the selection away from "everything". */
  isFiltering: boolean;
  allSelected: boolean;
  noneSelected: boolean;
};

const RetailerFilterContext = createContext<RetailerFilterContextValue | null>(
  null
);

export function RetailerFilterProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<RetailerId[]>(ALL_RETAILER_IDS);

  const toggle = useCallback((id: RetailerId) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => setSelected(ALL_RETAILER_IDS), []);
  const clearAll = useCallback(() => setSelected([]), []);

  const isSelected = useCallback(
    (id: RetailerId) => selected.includes(id),
    [selected]
  );

  const value = useMemo(
    () => ({
      selected,
      isSelected,
      toggle,
      selectAll,
      clearAll,
      isFiltering: selected.length < ALL_RETAILER_IDS.length,
      allSelected: selected.length === ALL_RETAILER_IDS.length,
      noneSelected: selected.length === 0,
    }),
    [selected, isSelected, toggle, selectAll, clearAll]
  );

  return (
    <RetailerFilterContext.Provider value={value}>
      {children}
    </RetailerFilterContext.Provider>
  );
}

export function useRetailerFilter() {
  const ctx = useContext(RetailerFilterContext);
  if (!ctx) {
    throw new Error(
      "useRetailerFilter must be used within a RetailerFilterProvider"
    );
  }
  return ctx;
}

export { ALL_RETAILER_IDS };

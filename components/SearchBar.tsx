"use client";

import { useState } from "react";
import { SearchIcon } from "./icons";

type SearchBarProps = {
  size?: "md" | "lg";
  placeholder?: string;
  className?: string;
  buttonLabel?: string;
  showIcon?: boolean;
};

export default function SearchBar({
  size = "md",
  placeholder = "Search for any product, brand, or store…",
  className = "",
  buttonLabel = "Search",
  showIcon = true,
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const isLarge = size === "lg";

  return (
    <div className="relative">
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className={`group relative flex w-full items-center gap-2 rounded-full border bg-noir-800 transition-all duration-300 ${
          isLarge ? "px-3 py-2.5 sm:px-4" : "px-2 py-1.5"
        } ${
          focused
            ? "border-gilt-400 shadow-soft-lg ring-4 ring-gilt-500/20"
            : "border-gilt-500/25 shadow-soft hover:shadow-soft-lg"
        } ${className}`}
      >
        {showIcon && (
          <span
            className={`flex shrink-0 items-center justify-center rounded-full text-ivory-300 transition-colors ${
              focused ? "text-gilt-400" : ""
            } ${isLarge ? "h-9 w-9" : "h-7 w-7"}`}
          >
            <SearchIcon className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
          </span>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={`w-full min-w-0 flex-1 bg-transparent text-ivory-50 placeholder:text-ivory-400 focus:outline-none ${
            isLarge ? "text-base sm:text-lg" : "text-sm"
          }`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-full bg-gilt-500 font-medium text-ivory-50 transition-all duration-300 hover:bg-gilt-400 active:scale-95 ${
            isLarge
              ? "px-5 py-2.5 text-sm sm:px-6 sm:text-base"
              : "px-4 py-1.5 text-xs"
          }`}
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  );
}

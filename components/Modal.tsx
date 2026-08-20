"use client";

import { useEffect } from "react";
import { CloseIcon } from "./icons";

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-noir-950/60 backdrop-blur-sm animate-fade-up"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-lg animate-fade-up rounded-2xl border border-gilt-500/25 bg-noir-800 p-6 shadow-soft-xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2
              id="modal-title"
              className="font-display text-xl font-medium text-ivory-50"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm text-ivory-300">{subtitle}</p>
            )}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ivory-300 transition-colors hover:bg-noir-700 hover:text-ivory-50"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

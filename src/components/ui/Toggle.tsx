"use client";

import { cn } from "@/lib/utils";

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on && !disabled ? "brand-gradient" : "bg-white/10", disabled && "cursor-not-allowed opacity-40")}
    >
      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </button>
  );
}

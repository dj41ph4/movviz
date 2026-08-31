"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Same click-outside/Escape idiom as UserMenu.tsx and Découverte's genre
 *  menu — the dropdown itself is portalled to document.body (position fixed,
 *  computed from the trigger's own rect) because this is meant to be used
 *  inside DashboardPosterCard's popover, which clips overflow to its own
 *  rounded panel; an absolutely-positioned dropdown got silently cut off
 *  there. `trigger` renders the button itself so callers can reuse an
 *  existing icon button (e.g. the chevron) instead of always getting the
 *  default "···" trigger. */
export function CardMenu({
  label,
  children,
  trigger,
}: {
  label: string;
  children: React.ReactNode;
  trigger?: (props: { onClick: (e: React.MouseEvent) => void; ref: React.RefObject<HTMLButtonElement | null> }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ left: Math.min(rect.right - 224, window.innerWidth - 232), top: rect.bottom + 8 });
    }
    setOpen((v) => !v);
  };
  return (
    <>
      {trigger ? (
        trigger({ onClick: (e) => { e.stopPropagation(); toggle(); }, ref: btnRef })
      ) : (
        <button
          ref={btnRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          title={label}
          aria-label={label}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 text-white transition-colors hover:border-white hover:bg-white/10"
        >
          <MoreVertical className="h-[18px] w-[18px]" />
        </button>
      )}
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[90] w-56 overflow-hidden rounded-xl border border-white/10 bg-[#171522]/98 p-1.5 shadow-2xl backdrop-blur-xl"
          style={{ left: pos.left, top: pos.top }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
}

export function MenuItem({ icon: Icon, label, onClick, tone, disabled, busy }: { icon: React.ElementType; label: string; onClick: () => void; tone?: "danger"; disabled?: boolean; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors disabled:opacity-50",
        tone === "danger" ? "text-down hover:bg-down/10" : "text-ink-soft hover:bg-white/5 hover:text-ink"
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

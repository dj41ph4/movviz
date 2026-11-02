"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export interface JumpItem {
  id: string;
  label: string;
}

/** DOM id of a dashboard row — the jump bar scrolls to it and tracks the one under the bar. */
export const dashboardRowAnchor = (key: string) => `dash-row-${key}`;

/**
 * Sticky shortcut bar over the dashboard rows: a click jumps straight to a row
 * instead of scrolling past thousands of pixels of carousels. It follows the
 * user's own row order (the pencil layout editor), it never reorders anything.
 * On phones the chips scroll sideways; from `sm` up they wrap onto a second line so no label is ever cut.
 * `children` sits at the right edge (the layout editor toggle).
 */
export function DashboardJumpBar({ items, children }: { items: JumpItem[]; children?: React.ReactNode }) {
  const t = useT();
  const [active, setActive] = useState<string | null>(null);
  const idsKey = items.map((i) => i.id).join("|");
  const navRef = useRef<HTMLElement>(null);
  // A clicked chip stays lit until the user scrolls by hand: the target row cannot
  // always reach the top of the page (last rows), so position alone would not light it.
  const pinnedRef = useRef<string | null>(null);

  // Keep the highlighted chip in view inside the (horizontally scrolling) bar.
  useEffect(() => {
    if (!active) return;
    const chip = navRef.current?.querySelector<HTMLElement>(`[data-jump="${active}"]`);
    chip?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  useEffect(() => {
    const ids = idsKey.split("|");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (pinnedRef.current) { setActive(pinnedRef.current); return; }
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(dashboardRowAnchor(id));
        if (el && el.getBoundingClientRect().top <= 230) current = id;
      }
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const unpin = () => { pinnedRef.current = null; schedule(); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("wheel", unpin, { passive: true });
    window.addEventListener("touchmove", unpin, { passive: true });
    window.addEventListener("keydown", unpin);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("wheel", unpin);
      window.removeEventListener("touchmove", unpin);
      window.removeEventListener("keydown", unpin);
    };
  }, [idsKey]);

  const jump = (id: string) => {
    pinnedRef.current = id;
    setActive(id);
    const el = document.getElementById(dashboardRowAnchor(id));
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="nx-dash-jump sticky top-[calc(var(--nx-topbar-h,3.5rem)+0.5rem)] z-20">
      <div className="flex items-center gap-2 rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[.07] to-white/[.03] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_16px_34px_-14px_rgba(0,0,0,.65)] backdrop-blur-xl">
        <nav ref={navRef} aria-label={t("dashboard.jumpTo")} className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto sm:flex-wrap sm:overflow-visible">
          {items.map((item) => (
            <button
              key={item.id}
              data-jump={item.id}
              type="button"
              onClick={() => jump(item.id)}
              aria-current={active === item.id ? "true" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors min-h-11 sm:min-h-9",
                active === item.id ? "brand-gradient text-white shadow-lg" : "text-ink-soft hover:bg-white/8 hover:text-ink"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </div>
  );
}

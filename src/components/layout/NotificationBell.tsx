"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useT } from "@/i18n/provider";
import { relativeTime } from "@/lib/utils";
import type { NotificationItem } from "@/lib/notifications/types";

/**
 * Notifications are stored server-side as kind + params, not a rendered
 * string — the server has no idea which locale is viewing them. Rendering
 * through the viewer's own t() here is what makes the bell actually follow
 * each user's chosen language. `message` (the server's fixed fallback text,
 * only meant for external webhooks) is the fallback for old records saved
 * before this existed, or any kind this list hasn't caught up with yet.
 */
function renderNotification(t: (path: string, params?: Record<string, string | number>) => string, n: NotificationItem): string {
  const key = `notifications.messages.${n.kind}`;
  const rendered = t(key, n.params);
  return rendered === key ? n.message : rendered;
}

export function NotificationBell() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cached by SWR so the bell state survives navigations without refetching.
  const { data, mutate } = useSWR<{ items: NotificationItem[] }>(
    "/api/notifications", { refreshInterval: 8000 }
  );
  const items = data?.items ?? [];
  const load = () => mutate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = items.filter((i) => !i.read).length;

  const toggle = async () => {
    setOpen((o) => !o);
    if (!open && unread > 0) {
      await fetch("/api/notifications", { method: "POST" });
      load();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl glass transition-colors hover:text-brand-glow"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-magenta ring-2 ring-void" />}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-2xl glass-strong p-2 shadow-2xl sm:w-80">
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="p-4 text-center text-sm text-ink-dim">{t("notifications.empty")}</p>}
            {items.slice(0, 20).map((n) => (
              <Link
                key={n.id}
                href={n.href ?? "#"}
                onClick={() => setOpen(false)}
                className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
              >
                <span className="text-ink-soft">{renderNotification(t, n)}</span>
                <span className="text-[11px] text-ink-dim">{relativeTime(new Date(n.createdAt).toISOString())}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

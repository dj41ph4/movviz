"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { usePendingRequests } from "@/lib/requests/usePendingRequests";
import { usePendingUsers } from "@/lib/auth/usePendingUsers";
import { useActiveDownloads } from "@/lib/downloads/useActiveDownloads";

const PRIMARY_HREFS = ["/discover", "/library", "/requests", "/activity"];

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  const user = useCurrentUser();
  const pendingRequests = usePendingRequests();
  const pendingUsers = usePendingUsers();
  const activeDownloads = useActiveDownloads();
  const [moreOpen, setMoreOpen] = useState(false);

  const liveCountFor = (liveBadge?: "pendingRequests" | "pendingUsers" | "activeDownloads") =>
    liveBadge === "pendingRequests" ? pendingRequests
    : liveBadge === "pendingUsers" ? pendingUsers
    : liveBadge === "activeDownloads" ? activeDownloads
    : 0;

  const items = NAV.filter((item) => !item.adminOnly || user?.role === "admin");
  const primary = PRIMARY_HREFS.map((href) => items.find((i) => i.href === href)).filter(
    (i): i is NonNullable<typeof i> => Boolean(i)
  );
  const rest = items.filter((i) => !PRIMARY_HREFS.includes(i.href));

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-white/5 bg-void/85 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {primary.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const liveCount = liveCountFor(item.liveBadge);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ring-focus",
                active ? "text-brand-glow" : "text-ink-dim"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              <span>{t(item.labelKey)}</span>
              {liveCount > 0 && (
                <span className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full brand-gradient px-1 text-[9px] font-bold text-white">
                  {liveCount}
                </span>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ring-focus",
            moreOpen || rest.some((i) => isActive(i.href)) ? "text-brand-glow" : "text-ink-dim"
          )}
        >
          <Menu className="h-5 w-5" />
          <span>{t("nav.more")}</span>
          {pendingUsers > 0 && (
            <span className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full brand-gradient px-1 text-[9px] font-bold text-white">
              {pendingUsers}
            </span>
          )}
        </button>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[75vh] w-full overflow-y-auto rounded-t-2xl glass-strong pb-2 pt-3 shadow-2xl"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
              <div className="flex items-center justify-between px-4 pb-2">
                <span className="text-sm font-bold text-ink">{t("nav.more")}</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim ring-focus hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col gap-1 px-2">
                {rest.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  const liveCount = liveCountFor(item.liveBadge);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ring-focus",
                        active ? "bg-brand/12 text-brand-glow" : "text-ink-soft active:bg-white/5"
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px]", active ? "text-brand-glow" : "text-ink-dim")} />
                      <span className="flex-1">{t(item.labelKey)}</span>
                      {liveCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full brand-gradient px-1.5 text-[10px] font-bold text-white">
                          {liveCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

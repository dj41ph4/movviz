"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/provider";
import { relativeTime, cn } from "@/lib/utils";
import type { MediaRequest } from "@/lib/requests/types";
import type { LibraryStatus } from "@/lib/library/types";
import { Check, X, Clock, CheckCircle2, Star, Film, HardDriveDownload, Search } from "lucide-react";

type RequestWithMedia = MediaRequest & { mediaStatus?: LibraryStatus | null };

const STATUS_TONE: Record<MediaRequest["status"], string> = {
  pending: "text-amber bg-amber/12 border-amber/25",
  approved: "text-ok bg-ok/12 border-ok/25",
  declined: "text-down bg-down/12 border-down/25",
};
const MEDIA_TONE: Record<LibraryStatus, string> = {
  available: "text-ok bg-ok/12 border-ok/25",
  downloading: "text-cyan bg-cyan/12 border-cyan/25",
  searching: "text-brand-glow bg-brand/12 border-brand/25",
  missing: "text-amber bg-amber/12 border-amber/25",
};
const MEDIA_ICON: Record<LibraryStatus, React.ElementType> = {
  available: CheckCircle2,
  downloading: HardDriveDownload,
  searching: Search,
  missing: Clock,
};

/** Approved requests badge with the media's real state; others keep the request state. */
function RequestBadge({ r, t }: { r: RequestWithMedia; t: (k: string) => string }) {
  if (r.status === "approved" && r.mediaStatus) {
    const Icon = MEDIA_ICON[r.mediaStatus];
    return (
      <span className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold", MEDIA_TONE[r.mediaStatus])}>
        <Icon className="h-3 w-3" /> {t(`status.${r.mediaStatus}`)}
      </span>
    );
  }
  return (
    <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold", STATUS_TONE[r.status])}>
      {t(`status.${r.status}`)}
    </span>
  );
}

export default function RequestsPage() {
  const t = useT();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, mutate } = useSWR<{ requests: RequestWithMedia[]; isAdmin: boolean }>(
    "/api/requests"
  );
  const requests = data?.requests ?? [];
  const isAdmin = !!data?.isAdmin;

  const decide = async (id: string, action: "approve" | "decline") => {
    setBusy(id);
    // Flip the badge immediately instead of leaving it on "pending" until
    // the round-trip and next poll land — the admin is often triaging a
    // batch of these back to back and shouldn't wait between clicks.
    mutate(
      (current) =>
        current
          ? { ...current, requests: current.requests.map((r) => (r.id === id ? { ...r, status: action === "approve" ? "approved" : "declined" } : r)) }
          : current,
      { revalidate: false }
    );
    try {
      await fetch(`/api/requests/${id}/${action}`, { method: "POST" });
      await mutate();
    } finally {
      setBusy(null);
    }
  };

  const visible = requests.filter((r) => tab === "all" || r.status === "pending");
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow={isAdmin ? `${pendingCount} ${t("requests.eyebrow")}` : undefined}
        title={isAdmin ? t("requests.title") : t("requests.myRequests")}
        description={isAdmin ? t("requests.description") : t("requests.myRequestsDescription")}
      >
        {isAdmin && (
          <div className="flex gap-1.5">
            {(["pending", "all"] as const).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  tab === tb ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink"
                )}
              >
                {tb === "pending" ? t("status.pending") : t("common.all")}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {visible.map((r) => {
            const poster = r.posterPath ? `https://image.tmdb.org/t/p/w200${r.posterPath}` : null;
            return (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="flex gap-4 rounded-2xl glass p-4"
              >
                <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-surface">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt={r.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Film className="h-6 w-6 text-ink-soft/50" /></div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-ink">{r.title}</h3>
                      <div className="mt-1 flex items-center gap-3 text-sm text-ink-dim">
                        <span className="flex items-center gap-1 font-semibold text-amber">
                          <Star className="h-3.5 w-3.5 fill-amber" /> {r.rating.toFixed(1)}
                        </span>
                        <span>{r.year ?? "—"}</span>
                      </div>
                    </div>
                    <RequestBadge r={r} t={t} />
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{r.overview}</p>

                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="text-xs text-ink-dim">
                      {isAdmin ? `${t("requests.requestedBy")} ${r.username} · ` : ""}
                      {relativeTime(new Date(r.createdAt).toISOString())}
                    </span>

                    {isAdmin && r.status === "pending" ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => decide(r.id, "decline")}
                          disabled={busy === r.id}
                          className="flex h-9 items-center gap-1.5 rounded-xl glass px-4 text-sm font-semibold text-down transition-colors hover:bg-down/10 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" /> {t("common.decline")}
                        </button>
                        <button
                          onClick={() => decide(r.id, "approve")}
                          disabled={busy === r.id}
                          className="flex h-9 items-center gap-1.5 rounded-xl brand-gradient px-4 text-sm font-bold text-white transition-transform hover:scale-105 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" /> {t("common.approve")}
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
                        {r.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-ok" /> : <Clock className="h-4 w-4" />}
                        {r.status === "approved" && r.mediaStatus ? t(`status.${r.mediaStatus}`) : t(`status.${r.status}`)}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {visible.length === 0 && (
          <div className="rounded-2xl glass py-20 text-center text-ink-dim">{t("requests.empty")}</div>
        )}
      </div>
    </div>
  );
}

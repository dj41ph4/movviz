"use client";

import useSWR from "swr";
import { Ban, Loader2, Unlock } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/i18n/provider";
import { formatDateTime } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import type { BlockedRelease } from "@/lib/library/blockedReleases";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((res) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
});

export default function BlockedTorrentsPage() {
  const t = useT();
  const { locale } = useI18n();
  const { data, mutate, isLoading } = useSWR<{ releases: BlockedRelease[] }>("/api/blocked-releases", fetcher);
  const releases = data?.releases ?? [];

  const unblock = async (infoHash: string) => {
    if (!(await confirmDialog(t("blockedTorrents.confirmUnblock")))) return;
    await fetch(`/api/blocked-releases/${encodeURIComponent(infoHash)}`, { method: "DELETE" });
    await mutate();
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow={t("nav.management")} title={t("blockedTorrents.title")} description={t("blockedTorrents.description")} />
      {isLoading ? (
        <div className="flex justify-center py-20 text-ink-dim"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : releases.length === 0 ? (
        <div className="rounded-2xl glass py-16 text-center">
          <Ban className="mx-auto mb-3 h-8 w-8 text-ink-dim" />
          <p className="font-semibold text-ink">{t("blockedTorrents.empty")}</p>
          <p className="mt-1 text-sm text-ink-dim">{t("blockedTorrents.emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {releases.map((release) => (
            <div key={release.infoHash} className="flex flex-wrap items-center gap-3 rounded-2xl glass p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-down/12 text-down"><Ban className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink" title={release.releaseTitle}>{release.releaseTitle || release.mediaTitle}</p>
                <p className="mt-0.5 text-xs text-ink-dim">{release.mediaTitle} · {release.indexer || t("blockedTorrents.unknownIndexer")} · {t("blockedTorrents.blockedBy", { user: release.blockedBy, date: formatDateTime(release.blockedAt, locale) })}</p>
                <p className="mt-1 break-all font-mono text-[10px] text-ink-dim">{release.infoHash}</p>
              </div>
              <button onClick={() => unblock(release.infoHash)} className="flex h-11 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft transition-colors hover:text-ok">
                <Unlock className="h-4 w-4" /> {t("blockedTorrents.unblock")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

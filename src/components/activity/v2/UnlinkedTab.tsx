"use client";

import { useState } from "react";
import useSWR from "swr";
import { Link2, FileQuestion } from "lucide-react";
import { useI18n, useT } from "@/i18n/provider";
import { formatBytes, formatDateTime } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/activity/v2/types";
import { LinkDownloadModal } from "./LinkDownloadModal";

export function UnlinkedTab() {
  const t = useT();
  const { locale } = useI18n();
  const { data, mutate } = useSWR<{ items: ActivityEntry[] }>("/api/activity/v2?tab=unlinked");
  const [target, setTarget] = useState<ActivityEntry | null>(null);
  const items = data?.items ?? [];

  if (data && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl glass py-16 text-center text-sm text-ink-dim">
        <FileQuestion className="h-6 w-6" />
        {t("activity.noUnlinked")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="mb-1 text-xs text-ink-dim">{t("activity.unlinkedHint")}</p>
      {items.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 rounded-xl glass p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{entry.import?.fileName}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-dim">
              {entry.import?.fileSize ? formatBytes(entry.import.fileSize) : null}
              <span>{formatDateTime(entry.timestamp, locale)}</span>
            </p>
          </div>
          <button
            onClick={() => setTarget(entry)}
            className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-brand/15 px-3.5 text-xs font-bold text-brand-glow transition-transform hover:scale-105"
          >
            <Link2 className="h-3.5 w-3.5" />
            {t("activity.linkDownload")}
          </button>
        </div>
      ))}
      {target && (
        <LinkDownloadModal
          entry={target}
          onClose={() => setTarget(null)}
          onLinked={() => mutate()}
        />
      )}
    </div>
  );
}

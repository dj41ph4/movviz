"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import { formatBytes } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/activity/v2/types";
import { TitleTargetPicker } from "./TitleTargetPicker";

export function LinkDownloadModal({
  entry,
  onClose,
  onLinked,
}: {
  entry: ActivityEntry;
  onClose: () => void;
  onLinked: () => void;
}) {
  const t = useT();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = async (libraryRef: string) => {
    setLinking(true);
    setError(null);
    try {
      const res = await fetch("/api/library/manual-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, libraryRef }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "error");
        return;
      }
      onLinked();
      onClose();
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl glass-strong p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink">{t("activity.linkDownload")}</h2>
            <p className="mt-1 truncate text-xs text-ink-dim">
              {entry.import?.fileName} {entry.import?.fileSize ? `— ${formatBytes(entry.import.fileSize)}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg glass text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {linking ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-dim">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
          </div>
        ) : (
          <TitleTargetPicker onPick={link} />
        )}

        {error && <p className="mt-3 text-xs font-semibold text-down">{t(`activity.linkError.${error}`)}</p>}
      </div>
    </div>
  );
}

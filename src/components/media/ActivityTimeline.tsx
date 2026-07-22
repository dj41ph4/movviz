"use client";

import useSWR from "swr";
import Link from "next/link";
import { useT } from "@/i18n/provider";
import { AlertCircle, Check, Download, PackageCheck, Plus, Trash2, X } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/activity/types";

const ICONS = {
  added: Plus,
  approved: Check,
  declined: X,
  removed: Trash2,
  grabbed: Download,
  imported: PackageCheck,
  failed: AlertCircle,
  upgraded: Download,
};

const TONES: Record<ActivityEntry["kind"], string> = {
  added: "text-brand-glow bg-brand/12",
  approved: "text-ok bg-ok/12",
  declined: "text-down bg-down/12",
  removed: "text-down bg-down/12",
  grabbed: "text-cyan bg-cyan/12",
  imported: "text-ok bg-ok/12",
  failed: "text-down bg-down/12",
  upgraded: "text-brand-glow bg-brand/12",
};

const LABEL_KEYS: Record<ActivityEntry["kind"], string> = {
  added: "activity.kinds.added",
  approved: "activity.kinds.approved",
  declined: "activity.kinds.declined",
  removed: "activity.kinds.removed",
  grabbed: "activity.kinds.grabbed",
  imported: "activity.kinds.imported",
  failed: "activity.kinds.failed",
  upgraded: "activity.kinds.upgraded",
};

export function ActivityTimeline({ entries: suppliedEntries, compact = false }: { entries?: ActivityEntry[]; compact?: boolean }) {
  const t = useT();
  const { data, error } = useSWR<{ entries: ActivityEntry[] }>(suppliedEntries ? null : "/api/activity", { refreshInterval: 5000 });
  const entries = suppliedEntries ?? data?.entries ?? [];
  const visible = compact ? entries.slice(0, 6) : entries;

  if (error) return compact ? null : <div className="rounded-2xl glass py-12 text-center text-sm text-ink-dim">{t("timeline.adminOnly")}</div>;

  return (
    <div className={compact ? "rounded-2xl glass p-5" : "space-y-2"}>
      {compact && <h2 className="mb-4 font-bold text-ink">{t("timeline.recent")}</h2>}
      <div className="space-y-1.5">
        {visible.map((entry) => {
          const Icon = ICONS[entry.kind];
          const content = (
            <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONES[entry.kind])}><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{entry.subject}</p>
                <p className={cn("truncate text-xs", entry.kind === "failed" ? "text-down" : "text-ink-dim")}>
                  {t(LABEL_KEYS[entry.kind])}{entry.details?.error ? ` — ${entry.details.error}` : entry.details?.releaseTitle ? ` — ${entry.details.releaseTitle}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-ink-dim">{relativeTime(new Date(entry.createdAt).toISOString())}</span>
            </div>
          );
          return entry.href ? <Link key={entry.id} href={entry.href}>{content}</Link> : <div key={entry.id}>{content}</div>;
        })}
        {!data && !suppliedEntries && <p className="py-6 text-center text-sm text-ink-dim">{t("common.loading")}</p>}
        {data && visible.length === 0 && <p className="py-6 text-center text-sm text-ink-dim">{t("activity.noActivity")}</p>}
      </div>
    </div>
  );
}

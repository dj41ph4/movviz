"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { QueueTab } from "@/components/activity/v2/QueueTab";
import { HistoryTab } from "@/components/activity/v2/HistoryTab";
import { WantedTab } from "@/components/activity/v2/WantedTab";
import { UnlinkedTab } from "@/components/activity/v2/UnlinkedTab";
import { DownloadLiveStats } from "@/components/media/DownloadLiveStats";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import useSWR from "swr";
import { usePremiumAppearance } from "@/components/appearance/AppearanceProvider";
import { formatBytes, formatSpeed } from "@/lib/utils";
import { Download, History, ListChecks, AlertCircle, Link2 } from "lucide-react";

const TABS = [
  { id: "queue", labelKey: "activity.queue", icon: Download },
  { id: "history", labelKey: "activity.history", icon: History },
  { id: "wanted", labelKey: "activity.wanted", icon: ListChecks },
  { id: "failures", labelKey: "activity.failures", icon: AlertCircle },
  { id: "unlinked", labelKey: "activity.unlinked", icon: Link2, adminOnly: true },
] as const;

export default function DownloadsPage() {
  return (
    <Suspense fallback={null}>
      <DownloadsPageInner />
    </Suspense>
  );
}

function DownloadsPageInner() {
  const t = useT();
  const user = useCurrentUser();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const premium = usePremiumAppearance();
  // Bêta : la description devient un résumé live (mêmes clés SWR que la colonne de droite, donc aucune requête en plus).
  const { data: engine } = useSWR<{ downloading: number; downloadSpeed: number }>(premium ? "/api/engine/stats" : null, { refreshInterval: 5000, revalidateOnFocus: false });
  const { data: system } = useSWR<{ disk: { free: number } | null }>(premium ? "/api/stats" : null, { refreshInterval: 30_000, revalidateOnFocus: false });
  const summary = [
    t("downloads.summaryActive", { count: engine?.downloading ?? 0 }),
    formatSpeed(engine?.downloadSpeed ?? 0),
    system?.disk ? t("downloads.summaryFree", { size: formatBytes(system.disk.free) }) : null,
  ].filter(Boolean).join(" · ");
  const visibleTabs = TABS.filter((tb) => !("adminOnly" in tb) || user?.role === "admin");
  const initialTab = visibleTabs.find((tb) => tb.id === params.get("tab"))?.id ?? "queue";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(initialTab);

  const pushTab = (id: (typeof TABS)[number]["id"]) => {
    setTab(id);
    const p = new URLSearchParams(params.toString());
    if (id === "queue") p.delete("tab");
    else p.set("tab", id);
    router.push(pathname + (p.toString() ? "?" + p.toString() : ""), { scroll: false });
  };

  return (
    <div className="nx-downloads-page mx-auto max-w-[1600px]">
      <PageHeader
        eyebrow={t("activity.eyebrow")}
        title={t("activity.title")}
        description={premium ? summary : t("activity.description")}
      />

      <div className="nx-dl-tabs mb-6 flex flex-wrap gap-1.5" role="tablist">
        {visibleTabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => pushTab(tb.id)}
            role="tab"
            aria-selected={tab === tb.id}
            className={cn(
              "nx-dl-tab flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              tab === tb.id ? "brand-gradient text-white shadow-lg" : "glass text-ink-soft hover:text-ink"
            )}
          >
            <tb.icon className="h-4 w-4" />
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        <div className={cn("gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_280px]", tab !== "queue" && "hidden")}>
          <QueueTab active={tab === "queue"} />
          <div className="nx-download-live-stats mt-6 lg:mt-0"><DownloadLiveStats /></div>
        </div>
        <div className={cn(tab !== "history" && "hidden")}><HistoryTab /></div>
        <div className={cn(tab !== "wanted" && "hidden")}><WantedTab active={tab === "wanted"} /></div>
        <div className={cn(tab !== "failures" && "hidden")}><HistoryTab failuresOnly={true} /></div>
        {user?.role === "admin" && <div className={cn(tab !== "unlinked" && "hidden")}><UnlinkedTab /></div>}
      </div>
    </div>
  );
}

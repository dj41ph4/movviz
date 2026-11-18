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
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { Download, History, ListChecks, AlertCircle, Link2, ChevronDown } from "lucide-react";
import DownloadsLoading from "./loading";

const TABS = [
  { id: "queue", labelKey: "activity.queue", icon: Download },
  { id: "history", labelKey: "activity.history", icon: History },
  { id: "wanted", labelKey: "activity.wanted", icon: ListChecks },
  { id: "failures", labelKey: "activity.failures", icon: AlertCircle },
  { id: "unlinked", labelKey: "activity.unlinked", icon: Link2, adminOnly: true },
] as const;

export default function DownloadsPage() {
  return (
    <Suspense fallback={<DownloadsLoading />}>
      <DownloadsPageRoute />
    </Suspense>
  );
}

function DownloadsPageRoute() {
  const params = useSearchParams();
  return <DownloadsPageInner key={`${params.get("tab") ?? "queue"}:${params.get("status") ?? ""}`} />;
}

function DownloadsPageInner() {
  const t = useT();
  const user = useCurrentUser();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tb) => !("adminOnly" in tb) || user?.role === "admin");
  const initialTab = visibleTabs.find((tb) => tb.id === params.get("tab"))?.id ?? "queue";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(initialTab);
  const completed = tab === "history" && params.get("status") === "completed";

  const pushTab = (id: (typeof TABS)[number]["id"], showCompleted = false) => {
    setTab(id);
    const p = new URLSearchParams(params.toString());
    if (id === "queue") p.delete("tab");
    else p.set("tab", id);
    if (showCompleted) p.set("status", "completed");
    else p.delete("status");
    router.push(pathname + (p.toString() ? "?" + p.toString() : ""), { scroll: false });
  };

  return (
    <div className="nx-downloads-page mx-auto max-w-[1600px]">
      <PageHeader title={t("activity.title")} compact />

      <div className="touch-download-navigation">
        <div className="touch-segments" aria-label={t("activity.title")}>
          <button type="button" aria-pressed={tab === "queue"} onClick={() => pushTab("queue")}>
            {t("downloads.inProgress")}
          </button>
          <button type="button" aria-pressed={completed} onClick={() => pushTab("history", true)}>
            {t("downloads.filter.completed")}
          </button>
        </div>
        <details>
          <summary className="touch-options-toggle" aria-label={t("nav.more")} title={t("nav.more")}>
            <ChevronDown size={19} />
          </summary>
          <div className="touch-download-destinations">
            {visibleTabs.filter((item) => item.id !== "queue").map((item) => (
              <button key={item.id} type="button" aria-pressed={!completed && tab === item.id} onClick={() => pushTab(item.id)}>
                <item.icon size={16} />{t(item.labelKey)}
              </button>
            ))}
          </div>
        </details>
      </div>

      <div className="nx-dl-tabs no-scrollbar mb-5 flex gap-1 overflow-x-auto border-b border-white/8" role="tablist">
        {visibleTabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => pushTab(tb.id)}
            role="tab"
            aria-selected={tab === tb.id}
            className={cn(
              "nx-dl-tab relative flex min-h-11 shrink-0 items-center gap-2 px-4 text-sm font-semibold transition-colors",
              tab === tb.id
                ? "text-white after:absolute after:inset-x-3 after:-bottom-px after:h-[3px] after:rounded-full after:bg-gradient-to-r after:from-brand after:to-brand-2 after:shadow-[0_0_14px_rgba(124,92,255,.8)]"
                : "text-ink-dim hover:text-ink"
            )}
          >
            <tb.icon className="h-4 w-4" />
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <div>
        {tab === "queue" && (
          <QueueTab />
        )}
        {tab === "history" && <HistoryTab initialCompleted={completed} />}
        {tab === "wanted" && <WantedTab />}
        {tab === "failures" && <HistoryTab failuresOnly />}
        {tab === "unlinked" && user?.role === "admin" && <UnlinkedTab />}
      </div>
    </div>
  );
}

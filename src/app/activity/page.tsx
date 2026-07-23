"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { QueueTab } from "@/components/activity/v2/QueueTab";
import { HistoryTab } from "@/components/activity/v2/HistoryTab";
import { WantedTab } from "@/components/activity/v2/WantedTab";
import { UnlinkedTab } from "@/components/activity/v2/UnlinkedTab";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { Download, History, ListChecks, AlertCircle, Link2 } from "lucide-react";

const TABS = [
  { id: "queue", labelKey: "activity.queue", icon: Download },
  { id: "history", labelKey: "activity.history", icon: History },
  { id: "wanted", labelKey: "activity.wanted", icon: ListChecks },
  { id: "failures", labelKey: "activity.failures", icon: AlertCircle },
  { id: "unlinked", labelKey: "activity.unlinked", icon: Link2, adminOnly: true },
] as const;

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityPageInner />
    </Suspense>
  );
}

function ActivityPageInner() {
  const t = useT();
  const user = useCurrentUser();
  const params = useSearchParams();
  const visibleTabs = TABS.filter((tb) => !("adminOnly" in tb) || user?.role === "admin");
  const initialTab = visibleTabs.find((tb) => tb.id === params.get("tab"))?.id ?? "queue";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(initialTab);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        eyebrow={t("activity.eyebrow")}
        title={t("activity.title")}
        description={t("activity.description")}
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {visibleTabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              tab === tb.id ? "brand-gradient text-white shadow-lg" : "glass text-ink-soft hover:text-ink"
            )}
          >
            <tb.icon className="h-4 w-4" />
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        <div className={cn(tab !== "queue" && "hidden")}><QueueTab active={tab === "queue"} /></div>
        <div className={cn(tab !== "history" && "hidden")}><HistoryTab /></div>
        <div className={cn(tab !== "wanted" && "hidden")}><WantedTab active={tab === "wanted"} /></div>
        <div className={cn(tab !== "failures" && "hidden")}><HistoryTab failuresOnly={true} /></div>
        {user?.role === "admin" && <div className={cn(tab !== "unlinked" && "hidden")}><UnlinkedTab /></div>}
      </div>
    </div>
  );
}

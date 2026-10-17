"use client";

import { useState } from "react";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";

type Preview = { applicable: boolean; fingerprint: string; episodes: number; preservedFiles: number; preservedTracking: number; blockers: string[] };

export function BleachRepairNotice({ seriesId, admin, onRepaired }: { seriesId: string; admin: boolean; onRepaired: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/library/series/${seriesId}/repair-bleach`;
  const { data, error, mutate, isValidating } = useSWR<Preview>(admin ? endpoint : null, async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("preview_failed");
    return response.json();
  });
  const reasons = data?.blockers.map((reason) => {
    if (reason === "active_download") return t("bleach.blockDownload");
    if (reason === "active_playback") return t("bleach.blockPlayback");
    if (reason === "ambiguous_user_history" || reason === "unknown_context_identity" || reason === "pending_history_sync") return t("bleach.blockHistory");
    return t("bleach.blockInspection");
  });
  const repair = async () => {
    if (!data?.applicable || busy) return;
    const accepted = await confirmDialog(t("bleach.repairConfirm").replace("{episodes}", String(data.episodes)).replace("{files}", String(data.preservedFiles)).replace("{watched}", String(data.preservedTracking)), { tone: "default", confirmLabel: t("bleach.repair") });
    if (!accepted) return;
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true, fingerprint: data.fingerprint }) });
      if (!response.ok) { await mutate(); throw new Error("repair_failed"); }
      toast("success", t("bleach.repaired"));
      onRepaired();
    } catch { toast("error", t("bleach.repairFailed")); }
    finally { setBusy(false); }
  };
  return <div className="mb-4 rounded-xl border border-amber/25 bg-amber/10 p-4 text-sm text-ink">
    <p className="font-semibold">{t("bleach.repairTitle")}</p>
    <p className="mt-1 text-ink-soft">{t("bleach.repairHint")}</p>
    {admin ? <>
      {error && <p role="alert" className="mt-2 text-amber">{t("bleach.previewFailed")}</p>}
      {data && !data.applicable && <p className="mt-2 text-amber">{[...new Set(reasons)].join(" ")}</p>}
      {(error || (data && !data.applicable)) && <button type="button" className="mt-2 min-h-11 rounded-lg border border-amber/25 px-3 font-semibold" disabled={isValidating} onClick={() => void mutate()}>{t("bleach.retry")}</button>}
      <button type="button" disabled={busy || !data?.applicable} onClick={() => void repair()} className="mt-3 min-h-11 rounded-lg bg-brand px-4 font-semibold text-white disabled:opacity-50">{busy ? t("common.loading") : t("bleach.repair")}</button>
    </> : <p className="mt-2 text-ink-soft">{t("bleach.adminRepair")}</p>}
  </div>;
}

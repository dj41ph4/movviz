"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/provider";
import { cn, formatBytes } from "@/lib/utils";
import type { EngineInstance } from "@/lib/types";
import { FolderPicker } from "./FolderPicker";
import {
  Film, Tv, Circle, FolderDown, FolderCheck, Layers, Zap, ArrowUpFromLine,
  Repeat, Power, WifiOff, Settings2, Check, X, Loader2, RefreshCw, Users,
  Upload, HardDrive,
} from "lucide-react";

/**
 * Live per-category download clients, read from and edited on the engine.
 * Shows the real, OS-resolved folders each instance uses and lets the user
 * remap the library folder to match their Plex libraries.
 */
export function DownloadClients() {
  const t = useT();
  const [instances, setInstances] = useState<EngineInstance[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pathMode, setPathMode] = useState<"browse" | "write">("write");
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    fetch("/api/system", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPathMode(d.mode === "browse" ? "browse" : "write"))
      .catch(() => {});
  }, []);

  const load = async () => {
    try {
      const res = await fetch("/api/engine/instances", { cache: "no-store" });
      const data = await res.json();
      setInstances(data.instances ?? []);
      setOffline(!!data.offline);
    } catch {
      setInstances(null);
      setOffline(true);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(() => { if (!editing) load(); }, 3000);
    return () => clearInterval(id);
  }, [editing]);

  const restart = async () => {
    setRestarting(true);
    try {
      await fetch("/api/engine/restart", { method: "POST" });
      // The engine takes a moment to bind its ports before it answers /health.
      await new Promise((r) => setTimeout(r, 1500));
      await load();
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <HardDrive className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("settings.tabClients")}</h3>
          <p className="mt-0.5 max-w-3xl text-xs text-ink-dim">{t("settings.clientsIntro")}</p>
        </div>
      </div>

      {offline && (
        <div className="mb-5 flex flex-col items-start gap-3 rounded-2xl border border-down/20 bg-white/[0.02] p-4 sm:flex-row sm:items-center">
          <WifiOff className="h-5 w-5 shrink-0 text-down" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">{t("downloads.engineOffline")}</p>
            <p className="text-xs text-ink-dim">{t("settings.engineOfflineEditHint")}</p>
          </div>
          <button
            onClick={restart}
            disabled={restarting}
            className="flex h-9 shrink-0 items-center gap-2 rounded-xl brand-gradient px-3.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {restarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t("settings.restartEngine")}
          </button>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {instances && instances.length === 0 ? (
          <div className="lg:col-span-2 rounded-2xl glass py-12 text-center">
            <HardDrive className="mx-auto mb-2 h-6 w-6 text-ink-dim" />
            <p className="font-semibold text-ink">{t("settings.noInstances")}</p>
            <p className="mt-1 text-sm text-ink-dim">{t("settings.engineOfflineEditHint")}</p>
          </div>
        ) : (
          (instances ?? []).map((inst) => (
          <InstanceCard
            key={inst.id}
            inst={inst}
            offline={offline}
            pathMode={pathMode}
            editing={editing === inst.id}
            onEdit={() => setEditing(inst.id)}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }}
          />
        ))
        )}
      </div>
    </div>
  );
}

function InstanceCard({
  inst, offline, pathMode, editing, onEdit, onClose, onSaved,
}: {
  inst: EngineInstance;
  offline: boolean;
  pathMode: "browse" | "write";
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const isMovies = inst.category === "movie";
  const CatIcon = isMovies ? Film : Tv;
  const catLabel = isMovies ? t("settings.instanceMovies") : t("settings.instanceSeries");
  const accent = isMovies ? "text-brand-glow bg-brand/12 border-brand/25" : "text-cyan bg-cyan/12 border-cyan/25";
  const dl = inst.downloadLimitKbps ? `${formatBytes(inst.downloadLimitKbps * 1024)}/s` : t("settings.unlimited");
  const ul = inst.uploadLimitKbps ? `${formatBytes(inst.uploadLimitKbps * 1024)}/s` : t("settings.unlimited");

  return (
    <div className="overflow-hidden rounded-2xl glass">
      <div className="flex items-center gap-3 border-b border-white/8 p-5">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl border", accent)}>
          <CatIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-ink">{catLabel}</h3>
            <Circle className={cn("h-2 w-2 fill-current", offline ? "text-down" : "text-ok")} />
          </div>
          <p className="text-xs text-ink-dim">
            {t("settings.boundTo")}: <span className="font-semibold capitalize text-ink-soft">{isMovies ? t("common.movies") : t("common.series")}</span>
            {" · "}
            {offline ? t("downloads.engineOffline") : `${inst.active} ${t("common.active")}`}
          </p>
        </div>
        <span className="rounded-lg bg-black/30 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{t("settings.protocolTorrent")}</span>
      </div>

      {inst.folderError && (
        <div className="border-b border-down/20 bg-down/10 px-5 py-3">
          <p className="text-xs font-semibold text-down">{t("settings.folderError")}</p>
          <p className="mt-0.5 break-all font-mono text-[11px] text-ink-soft">{inst.folderError}</p>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EditForm inst={inst} pathMode={pathMode} onClose={onClose} onSaved={onSaved} />
          </motion.div>
        ) : (
          <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="divide-y divide-white/5">
              <ConfigRow icon={FolderDown} label={t("settings.downloadPath")} value={inst.downloadPath} mono />
              <ConfigRow icon={FolderCheck} label={t("settings.completedPath")} value={inst.completedPath} mono />
              <ConfigRow icon={Layers} label={t("settings.maxActive")} value={String(inst.maxActive)} />
              <ConfigRow icon={Zap} label={t("settings.dlLimit")} value={dl} />
              <ConfigRow icon={ArrowUpFromLine} label={t("settings.ulLimit")} value={ul} />
              <ConfigRow icon={Repeat} label={t("settings.seedRatio")} value={`${inst.seedRatio.toFixed(1)}×`} />
              <ConfigRow icon={Users} label={t("settings.maxPeers")} value={String(inst.maxPeers)} />
              <ConfigRow icon={Upload} label={t("settings.uploadSlots")} value={String(inst.uploadSlots)} />
              <div className="flex items-center gap-3 p-4">
                <Power className="h-4 w-4 text-ink-dim" />
                <span className="flex-1 text-sm text-ink-soft">{t("settings.autoStart")}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", inst.autoStart ? "bg-ok/15 text-ok" : "bg-white/5 text-ink-dim")}>
                  {inst.autoStart ? t("common.enabled") : t("common.disabled")}
                </span>
              </div>
            </div>
            <div className="p-4 pt-3">
              <button onClick={onEdit} className="flex w-full items-center justify-center gap-2 rounded-xl glass-strong py-2.5 text-sm font-bold text-ink transition-transform hover:scale-[1.01]">
                <Settings2 className="h-4 w-4" /> {t("settings.editInstance")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EditForm({ inst, pathMode, onClose, onSaved }: { inst: EngineInstance; pathMode: "browse" | "write"; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const [f, setF] = useState({
    completedPath: inst.completedPath,
    downloadPath: inst.downloadPath,
    maxActive: inst.maxActive,
    downloadLimitKbps: inst.downloadLimitKbps,
    uploadLimitKbps: inst.uploadLimitKbps,
    seedRatio: inst.seedRatio,
    autoStart: inst.autoStart,
    maxPeers: inst.maxPeers,
    uploadSlots: inst.uploadSlots,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/engine/instances/${inst.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          completedPath: f.completedPath.trim(),
          downloadPath: f.downloadPath.trim(),
          maxActive: Number(f.maxActive) || 1,
          downloadLimitKbps: Number(f.downloadLimitKbps) || 0,
          uploadLimitKbps: Number(f.uploadLimitKbps) || 0,
          seedRatio: Number(f.seedRatio) || 0,
          autoStart: !!f.autoStart,
          maxPeers: Number(f.maxPeers) || 0,
          uploadSlots: Number(f.uploadSlots) || 0,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const input = "h-10 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand/40";

  return (
    <div className="space-y-4 p-5">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("settings.libraryFolder")}</label>
        <FolderPicker value={f.completedPath} onChange={(v) => set("completedPath", v)} mode={pathMode} />
        <p className="mt-1.5 text-[11px] text-ink-dim">{t("settings.libraryHint")}</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("settings.downloadFolder")}</label>
        <FolderPicker value={f.downloadPath} onChange={(v) => set("downloadPath", v)} mode={pathMode} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("settings.maxActive")}</label>
          <input type="number" min={1} value={f.maxActive} onChange={(e) => set("maxActive", e.target.value)} className={input} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("settings.seedRatio")}</label>
          <input type="number" step={0.1} min={0} value={f.seedRatio} onChange={(e) => set("seedRatio", e.target.value)} className={input} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("settings.maxPeers")}</label>
          <input type="number" min={0} value={f.maxPeers} onChange={(e) => set("maxPeers", e.target.value)} className={input} />
          <p className="mt-1 text-[11px] text-ink-dim">{t("settings.peersHint")}</p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("settings.uploadSlots")}</label>
          <input type="number" min={0} value={f.uploadSlots} onChange={(e) => set("uploadSlots", e.target.value)} className={input} />
          <p className="mt-1 text-[11px] text-ink-dim">{t("settings.uploadSlotsHint")}</p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("settings.dlLimit")}</label>
          <input type="number" min={0} value={f.downloadLimitKbps} onChange={(e) => set("downloadLimitKbps", e.target.value)} className={input} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("settings.ulLimit")}</label>
          <input type="number" min={0} value={f.uploadLimitKbps} onChange={(e) => set("uploadLimitKbps", e.target.value)} className={input} />
        </div>
      </div>
      <p className="text-[11px] text-ink-dim">{t("settings.kbpsHint")}</p>
      <div className="flex items-center gap-3">
        <Power className="h-4 w-4 text-ink-dim" />
        <span className="flex-1 text-sm text-ink-soft">{t("settings.autoStart")}</span>
        <button onClick={() => set("autoStart", !f.autoStart)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", f.autoStart ? "brand-gradient" : "bg-white/10")}>
          <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", f.autoStart && "translate-x-5")} />
        </button>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="flex items-center gap-1.5 rounded-xl glass px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink">
          <X className="h-4 w-4" /> {t("settings.cancel")}
        </button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl brand-gradient px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("settings.save")}
        </button>
      </div>
    </div>
  );
}

function ConfigRow({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Icon className="h-4 w-4 shrink-0 text-ink-dim" />
      <span className="shrink-0 text-sm text-ink-soft">{label}</span>
      <span className={cn("ml-auto truncate text-sm font-semibold text-ink", mono && "font-mono text-xs")} title={value}>
        {value}
      </span>
    </div>
  );
}

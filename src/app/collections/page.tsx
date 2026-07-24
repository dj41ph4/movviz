"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useT } from "@/i18n/provider";
import { Loader2, Plus, Trash2, Layers, RefreshCw, Grid2x2, Grid3x3, List, Check, RotateCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import type { Collection } from "@/lib/collections/types";

type ViewMode = "large" | "small" | "list";

function useViewMode(storageKey: string): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>("large");
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as ViewMode | null;
    if (stored === "large" || stored === "small" || stored === "list") setView(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(storageKey, v);
  };
  return [view, update];
}

function ViewModeToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const t = useT();
  const options: { id: ViewMode; icon: typeof Grid2x2; labelKey: string }[] = [
    { id: "large", icon: Grid2x2, labelKey: "collections.viewLarge" },
    { id: "small", icon: Grid3x3, labelKey: "collections.viewSmall" },
    { id: "list", icon: List, labelKey: "collections.viewList" },
  ];
  return (
    <div className="flex items-center gap-1 rounded-xl glass p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          title={t(o.labelKey)}
          aria-label={t(o.labelKey)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            view === o.id ? "brand-gradient text-white shadow" : "text-ink-dim hover:text-ink"
          )}
        >
          <o.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

interface SagaSummary {
  collectionId: number;
  name: string;
  posterPath: string | null;
  ownedCount: number;
  totalCount: number;
}

function SagaRatioBadge({ ownedCount, totalCount }: { ownedCount: number; totalCount: number }) {
  const complete = ownedCount >= totalCount;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm",
        complete ? "border-ok/30 bg-ok/15 text-ok" : "border-amber/30 bg-amber/15 text-amber"
      )}
    >
      {complete && <Check className="h-2.5 w-2.5" />}
      {ownedCount}/{totalCount}
    </span>
  );
}

function SagasSection() {
  const t = useT();
  const user = useCurrentUser();
  const [sagas, setSagas] = useState<SagaSummary[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [view, setView] = useViewMode("movviz-sagas-view");

  const load = () =>
    fetch("/api/collections/sagas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSagas(d?.sagas ?? []));

  const pollScan = async () => {
    for (;;) {
      const res = await fetch("/api/collections/scan-sagas", { cache: "no-store" });
      const status = await res.json();
      if (!status.running) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    setScanning(false);
    await load();
  };

  const startScan = async () => {
    setScanning(true);
    await fetch("/api/collections/scan-sagas", { method: "POST" });
    pollScan();
  };

  useEffect(() => { load(); }, []);

  if (sagas === null) {
    return (
      <div className="mb-10 animate-pulse">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="h-5 w-40 rounded bg-white/10" />
            <div className="mt-2 h-3.5 w-64 rounded bg-white/5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{t("collections.sagasTitle")}</h2>
          <p className="text-sm text-ink-dim">{t("collections.sagasHint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle view={view} onChange={setView} />
          {user?.role === "admin" && (
            <button
              onClick={startScan}
              disabled={scanning}
              className="flex items-center gap-2 rounded-xl glass px-3.5 py-2 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
            >
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {scanning ? t("collections.scanning") : t("collections.scanLibrary")}
            </button>
          )}
        </div>
      </div>

      {sagas.length === 0 ? (
        <p className="rounded-2xl glass p-5 text-sm text-ink-dim">{t("collections.sagasEmpty")}</p>
      ) : view === "list" ? (
        <div className="space-y-2">
          {sagas.map((s) => {
            const pct = Math.min(100, Math.round((s.ownedCount / s.totalCount) * 100));
            return (
              <Link
                key={s.collectionId}
                href={`/collection/${s.collectionId}`}
                className="group flex items-center gap-3.5 overflow-hidden rounded-xl glass-strong p-2 transition hover:glass-stronger"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand-glow/20 to-purple/20">
                  {s.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`https://image.tmdb.org/t/p/w185${s.posterPath}`} alt={s.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Layers className="h-5 w-5 text-ink-soft/60" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{s.name}</p>
                  <div className="mt-1.5 h-1 w-full max-w-40 overflow-hidden rounded-full bg-white/8">
                    <div className={cn("h-full rounded-full", pct >= 100 ? "bg-ok" : "brand-gradient")} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <SagaRatioBadge ownedCount={s.ownedCount} totalCount={s.totalCount} />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={cn("grid gap-4", view === "small" ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6")}>
          {sagas.map((s) => {
            const pct = Math.min(100, Math.round((s.ownedCount / s.totalCount) * 100));
            return (
              <Link
                key={s.collectionId}
                href={`/collection/${s.collectionId}`}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface transition hover:border-brand/30"
              >
                <div className="aspect-[2/3]">
                  {s.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`https://image.tmdb.org/t/p/w342${s.posterPath}`} alt={s.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/20 to-purple/20">
                      <Layers className="h-8 w-8 text-ink-soft/60" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                  <div className={cn("h-full", pct >= 100 ? "bg-ok" : "brand-gradient")} style={{ width: `${pct}%` }} />
                </div>
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/25 to-transparent p-3 pb-3.5">
                  <p className={cn("truncate font-semibold text-white", view === "small" ? "text-xs" : "text-sm")}>{s.name}</p>
                  <SagaRatioBadge ownedCount={s.ownedCount} totalCount={s.totalCount} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CollectionsPage() {
  const t = useT();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useViewMode("movviz-collections-view");

  const load = () => {
    setError(false);
    setLoading(true);
    fetch("/api/collections", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.collections) setCollections(d.collections);
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  if (error) {
    return (
      <div>
        <SagasSection />
        <div className="flex flex-col items-center gap-3 rounded-2xl glass py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-down" />
          <p className="font-semibold text-ink">{t("error.title")}</p>
          <p className="max-w-md text-sm text-ink-dim">{t("error.description")}</p>
          <button
            onClick={load}
            className="mt-2 flex items-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white"
          >
            <RotateCw className="h-4 w-4" /> {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <SagasSection />
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-white/8" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 animate-pulse rounded-xl bg-white/8" />
            <div className="h-10 w-32 animate-pulse rounded-xl bg-white/10" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white/6" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SagasSection />

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">{t("collections.title")}</h1>
        <div className="flex items-center gap-2">
          <ViewModeToggle view={view} onChange={setView} />
          <button className="flex items-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white">
            <Plus className="h-4 w-4" /> {t("collections.new")}
          </button>
        </div>
      </div>

      {collections.length === 0 ? (
        <div className="rounded-2xl glass py-12 text-center">
          <p className="font-semibold text-ink">{t("collections.empty")}</p>
          <p className="mt-1 text-sm text-ink-dim">{t("collections.emptyHint")}</p>
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">
          {collections.map((col) => (
            <div
              key={col.id}
              className="group flex items-center gap-3.5 overflow-hidden rounded-xl glass-strong p-2 hover:glass-stronger transition"
            >
              <div
                className="h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br from-brand-glow/20 to-purple/20 bg-cover bg-center"
                style={{ backgroundImage: col.posterPath ? `url(${col.posterPath})` : undefined }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">{col.name}</p>
                <p className="text-xs text-ink-dim">{col.items.length} {t("collections.items")}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn("grid gap-4", view === "small" ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6")}>
          {collections.map((col) => (
            <div
              key={col.id}
              className="group relative overflow-hidden rounded-2xl glass-strong hover:glass-stronger transition"
            >
              <div
                className="aspect-square bg-gradient-to-br from-brand-glow/20 to-purple/20 flex items-center justify-center"
                style={{
                  backgroundImage: col.posterPath ? `url(${col.posterPath})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-black/50 group-hover:bg-black/60 transition" />
                <div className="relative text-center">
                  <p className={cn("font-bold text-white", view === "small" && "text-sm")}>{col.name}</p>
                  <p className="text-xs text-white/70">{col.items.length} {t("collections.items")}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

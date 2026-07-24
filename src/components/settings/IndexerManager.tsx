"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { CatalogEntry, IndexerAuthType, IndexerCapabilities } from "@/lib/indexers/types";
import type { CategoryNode } from "@/lib/indexers/categories";
import { CategoryPicker } from "./CategoryPicker";
import {
  Magnet, Server, Plus, Circle, Trash2, Wifi, Loader2, X, Check, ArrowLeft, KeyRound, UserRound, Tags, SlidersHorizontal,
} from "lucide-react";

interface Row {
  id: string;
  name: string;
  protocol: "torrent" | "usenet";
  kind: string;
  baseUrl: string;
  enabled: boolean;
  priority: number;
  categories: number[];
  hasApiKey: boolean;
  hasCredentials: boolean;
  lastTest?: { ok: boolean; at: number; detail?: string };
  minSizeMb?: number;
  maxSizeMb?: number;
  maxAgeDays?: number;
  useFlareResolver?: boolean;
  caps?: IndexerCapabilities | null;
}

export function IndexerManager() {
  const t = useT();
  const [rows, setRows] = useState<Row[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [editingCats, setEditingCats] = useState<string | null>(null);
  const [editingFilters, setEditingFilters] = useState<string | null>(null);
  const [resolverUrl, setResolverUrl] = useState("");
  const [resolverSaving, setResolverSaving] = useState(false);

  useEffect(() => {
    fetch("/api/resolver", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setResolverUrl(d.url ?? "http://localhost:9830"))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/indexers", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).indexers ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm(t("indexerMgr.confirmRemove"))) return;
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== id));
    try {
      await fetch(`/api/indexers/${id}`, { method: "DELETE" });
    } catch {
      setRows(prev);
    }
  };
  const toggle = async (r: Row) => {
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)));
    try {
      await fetch(`/api/indexers/${r.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !r.enabled }),
      });
    } catch {
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: r.enabled } : x)));
    }
  };
  const test = async (id: string) => {
    setTesting(id);
    try {
      await fetch(`/api/indexers/${id}/test`, { method: "POST" });
      await load();
    } finally {
      setTesting(null);
    }
  };
  const saveCategories = async (id: string, categories: number[]) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, categories } : r)));
    await fetch(`/api/indexers/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categories }),
    });
  };
  const saveFilters = async (id: string, patch: { minSizeMb?: number; maxSizeMb?: number; maxAgeDays?: number }) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await fetch(`/api/indexers/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  };
  const savePriority = async (id: string, priority: number) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, priority } : r)));
    await fetch(`/api/indexers/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priority }),
    });
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Magnet className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("settings.tabIndexers")}</h3>
          <p className="mt-0.5 max-w-3xl text-xs text-ink-dim">{t("indexerMgr.intro")}</p>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-xl glass-strong px-4 py-3">
        <label className="shrink-0 text-xs font-semibold text-ink-soft">{t("indexerMgr.resolverUrl")}</label>
        <input
          value={resolverUrl}
          onChange={(e) => setResolverUrl(e.target.value)}
          onBlur={async () => {
            setResolverSaving(true);
            try {
              await fetch("/api/resolver", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ url: resolverUrl }),
              });
            } finally {
              setResolverSaving(false);
            }
          }}
          placeholder="http://localhost:9830"
          className="h-9 flex-1 rounded-lg border border-white/8 bg-black/30 px-3 text-xs font-mono text-ink outline-none focus:border-brand/40"
        />
        {resolverSaving && <Loader2 className="h-4 w-4 animate-spin text-ink-dim" />}
      </div>

      <div className="space-y-3">
        {rows.map((r) => {
          const status = r.lastTest ? (r.lastTest.ok ? "ok" : "fail") : "untested";
          const dot = status === "ok" ? "text-ok" : status === "fail" ? "text-down" : "text-ink-dim";
          return (
            <div key={r.id} className="rounded-2xl glass p-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", r.protocol === "torrent" ? "bg-cyan/12 text-cyan" : "bg-brand/12 text-brand-glow")}>
                  {r.protocol === "torrent" ? <Magnet className="h-5 w-5" /> : <Server className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold text-ink">{r.name}</h3>
                    <Circle className={cn("h-2 w-2 fill-current", dot)} />
                    <span className={cn("text-xs font-semibold", dot)}>
                      {status === "ok" ? t("indexerMgr.testOk") : status === "fail" ? `${t("indexerMgr.testFail")}${r.lastTest?.detail ? " · " + r.lastTest.detail : ""}` : t("indexerMgr.untested")}
                    </span>
                    {r.hasApiKey && (
                      <span title={t("indexerMgr.apiKey")}><KeyRound className="h-3 w-3 text-ink-dim" /></span>
                    )}
                    {r.hasCredentials && (
                      <span title={t("indexerMgr.credentials")}><UserRound className="h-3 w-3 text-ink-dim" /></span>
                    )}
                  </div>
                  <p className="truncate text-xs text-ink-dim">
                    {r.protocol === "torrent" ? t("indexerMgr.torrent") : t("indexerMgr.usenet")} · {r.baseUrl}
                  </p>
                </div>
                <button
                  onClick={() => setEditingCats(editingCats === r.id ? null : r.id)}
                  className={cn("flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors", editingCats === r.id ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink")}
                >
                  <Tags className="h-4 w-4 shrink-0" />
                  {t("indexerMgr.categories")}
                </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => savePriority(r.id, Math.max(0, r.priority - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg glass text-xs text-ink-dim hover:text-ink"
                      title={t("indexerMgr.priorityDown")}
                    >−</button>
                    <span className="min-w-[1.5rem] text-center text-xs font-bold text-ink" title={`${t("indexerMgr.priority")}: ${r.priority}`}>{r.priority}</span>
                    <button
                      onClick={() => savePriority(r.id, r.priority + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg glass text-xs text-ink-dim hover:text-ink"
                      title={t("indexerMgr.priorityUp")}
                    >+</button>
                  </div>
                  <button
                    onClick={() => setEditingFilters(editingFilters === r.id ? null : r.id)}
                    className={cn("flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors", editingFilters === r.id ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink")}
                  >
                    <SlidersHorizontal className="h-4 w-4 shrink-0" />
                    {t("indexerMgr.filters")}
                  </button>
                <button onClick={() => test(r.id)} disabled={testing === r.id} className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl glass px-3 text-sm font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-50">
                  {testing === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                  {testing === r.id ? t("indexerMgr.testing") : t("indexerMgr.test")}
                </button>
                <button
                  onClick={async () => {
                    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, useFlareResolver: !x.useFlareResolver } : x)));
                    try {
                      await fetch(`/api/indexers/${r.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ useFlareResolver: !r.useFlareResolver }),
                      });
                    } catch {
                      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, useFlareResolver: r.useFlareResolver } : x)));
                    }
                  }}
                  className={cn("flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition-colors", r.useFlareResolver ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink")}
                  title={t("indexerMgr.flareResolver")}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  CF
                </button>
                <Toggle on={r.enabled} onChange={() => toggle(r)} />
                <button onClick={() => remove(r.id)} className="flex h-9 w-9 items-center justify-center rounded-xl glass text-ink-dim transition-colors hover:bg-down/15 hover:text-down">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <AnimatePresence>
                {editingCats === r.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 border-t border-white/8 pt-4">
                      <CategoryPicker value={r.categories} onChange={(cats) => saveCategories(r.id, cats)} indexerCategories={r.caps?.categories ?? undefined} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {editingFilters === r.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-3">
                      <FilterField
                        label={t("indexerMgr.minSize")}
                        value={r.minSizeMb}
                        onCommit={(v) => saveFilters(r.id, { minSizeMb: v })}
                      />
                      <FilterField
                        label={t("indexerMgr.maxSize")}
                        value={r.maxSizeMb}
                        onCommit={(v) => saveFilters(r.id, { maxSizeMb: v })}
                      />
                      <FilterField
                        label={t("indexerMgr.maxAge")}
                        value={r.maxAgeDays}
                        onCommit={(v) => saveFilters(r.id, { maxAgeDays: v })}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {rows.length === 0 && !showForm && (
          <div className="rounded-2xl glass py-12 text-center">
            <p className="font-semibold text-ink">{t("indexerMgr.none")}</p>
            <p className="mt-1 text-sm text-ink-dim">{t("indexerMgr.noneHint")}</p>
          </div>
        )}

        <AnimatePresence>
          {showForm && <AddFlow t={t} onDone={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
        </AnimatePresence>

        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-4 text-sm font-semibold text-ink-dim transition-colors hover:border-brand/40 hover:text-brand-glow">
            <Plus className="h-4 w-4" /> {t("indexerMgr.add")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Two-step add flow: pick a predefined indexer (or a generic endpoint), then fill in only what it needs to authenticate. */
function AddFlow({ t, onDone, onCancel }: { t: (k: string) => string; onDone: () => void; onCancel: () => void }) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [picked, setPicked] = useState<CatalogEntry | null>(null);

  useEffect(() => {
    fetch("/api/indexers/catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCatalog(d.catalog ?? []));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="rounded-2xl glass-strong p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {picked && (
              <button onClick={() => setPicked(null)} className="text-ink-dim hover:text-ink"><ArrowLeft className="h-4 w-4" /></button>
            )}
            <h3 className="font-bold text-ink">{picked ? picked.name : t("indexerMgr.addTitle")}</h3>
          </div>
          <button onClick={onCancel} className="text-ink-dim hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        {!picked ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog.map((c) => (
              <button
                key={c.key}
                onClick={() => setPicked(c)}
                className="flex items-start gap-3 rounded-xl border border-white/8 bg-black/20 p-3 text-left transition-colors hover:border-brand/40"
              >
                <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", c.protocol === "torrent" ? "bg-cyan/12 text-cyan" : "bg-brand/12 text-brand-glow")}>
                  {c.protocol === "torrent" ? <Magnet className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-ink">{c.name}</span>
                  <span className="block text-xs text-ink-dim">{c.description}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <IndexerForm t={t} entry={picked} onDone={onDone} onCancel={onCancel} />
        )}
      </div>
    </motion.div>
  );
}

function IndexerForm({ t, entry, onDone, onCancel }: { t: (k: string) => string; entry: CatalogEntry; onDone: () => void; onCancel: () => void }) {
  const isGeneric = !entry.baseUrl;
  const [name, setName] = useState(entry.name);
  const [baseUrl, setBaseUrl] = useState(entry.baseUrl ?? "");
  const [authType, setAuthType] = useState<IndexerAuthType>(entry.authType);
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [categories, setCategories] = useState<number[]>(entry.categories ?? [2000, 5000]);
  const [saving, setSaving] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [realCategories, setRealCategories] = useState<CategoryNode[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const field = "h-11 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand/40";

  const loadCategories = async () => {
    if (!baseUrl.trim()) return;
    // Skip the round trip entirely when the credentials field is empty —
    // the indexer would just reject with an HTTP 401 that means nothing to
    // most users ("HTTP 401" isn't self-explanatory; "enter your API key" is).
    if (authType === "apikey" && !apiKey.trim()) {
      setCategoriesError(t("indexerMgr.categoriesNeedKey"));
      return;
    }
    if (authType === "x-api-key" && !apiKey.trim()) {
      setCategoriesError(t("indexerMgr.categoriesNeedKey"));
      return;
    }
    if (authType === "credentials" && (!username.trim() || !password.trim())) {
      setCategoriesError(t("indexerMgr.categoriesNeedCredentials"));
      return;
    }
    setLoadingCategories(true);
    setCategoriesError(null);
    try {
      const res = await fetch("/api/indexers/test-draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: entry.kind,
          protocol: entry.protocol,
          baseUrl: baseUrl.trim(),
          authType,
          apiKey: apiKey.trim(),
          username: username.trim(),
          password,
        }),
      });
      const result = await res.json();
      if (!result.ok) {
        const detail: string | undefined = result.detail;
        setCategoriesError(
          detail === "HTTP 401" || detail === "HTTP 403"
            ? t("indexerMgr.categoriesInvalidKey")
            : detail ?? t("indexerMgr.testFail")
        );
        return;
      }
      setRealCategories(result.caps?.categories ?? []);
    } catch {
      setCategoriesError(t("indexerMgr.testFail"));
    } finally {
      setLoadingCategories(false);
    }
  };

  const save = async () => {
    if (!baseUrl.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/indexers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: entry.key,
          name: name.trim() || entry.name,
          kind: entry.kind,
          protocol: entry.protocol,
          baseUrl: baseUrl.trim(),
          authType,
          apiKey: apiKey.trim(),
          username: username.trim(),
          password,
          categories,
        }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("indexerMgr.name")}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </div>

      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("indexerMgr.url")}</label>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t("indexerMgr.urlHint")} className={cn(field, "font-mono text-xs")} />
      </div>

      {isGeneric && (
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("indexerMgr.authMode")}</label>
          <div className="flex gap-1 rounded-xl glass p-1">
            {(["apikey", "x-api-key", "credentials"] as const).map((a) => (
              <button key={a} onClick={() => setAuthType(a)} className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors", authType === a ? "brand-gradient text-white" : "text-ink-soft hover:text-ink")}>
                {a === "apikey" ? t("indexerMgr.apiKey") : a === "x-api-key" ? t("indexerMgr.xApiKey") : t("indexerMgr.credentials")}
              </button>
            ))}
          </div>
        </div>
      )}

      {authType === "apikey" || authType === "x-api-key" ? (
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("indexerMgr.apiKey")}</label>
          <input value={apiKey} onChange={(e) => { setApiKey(e.target.value); setRealCategories(null); }} type="password" placeholder="••••••••" autoComplete="off" className={field} />
        </div>
      ) : (
        <>
          <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("indexerMgr.username")}</label>
              <input value={username} onChange={(e) => { setUsername(e.target.value); setRealCategories(null); }} autoComplete="off" className={field} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("indexerMgr.password")}</label>
              <input value={password} onChange={(e) => { setPassword(e.target.value); setRealCategories(null); }} type="password" placeholder="••••••••" autoComplete="off" className={field} />
          </div>
        </>
      )}

      <div className="sm:col-span-2">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-xs font-semibold text-ink-soft">{t("indexerMgr.categories")}</label>
          <button
            onClick={loadCategories}
            disabled={loadingCategories || !baseUrl.trim()}
            className="flex h-8 items-center gap-1.5 rounded-lg glass-strong px-3 text-xs font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
          >
            {loadingCategories ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            {t("indexerMgr.loadCategories")}
          </button>
        </div>
        {categoriesError && <p className="mb-2 text-xs text-down">{categoriesError}</p>}
        <CategoryPicker value={categories} onChange={setCategories} indexerCategories={realCategories ?? undefined} />
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:col-span-2">
        <button onClick={onCancel} className="rounded-xl glass px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink">{t("indexerMgr.cancel")}</button>
        <button onClick={save} disabled={saving || !baseUrl.trim()} className="flex items-center gap-2 rounded-xl brand-gradient px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("indexerMgr.save")}
        </button>
      </div>
    </div>
  );
}

function FilterField({ label, value, onCommit }: { label: string; value: number | undefined; onCommit: (v: number | undefined) => void }) {
  const [local, setLocal] = useState(value ? String(value) : "");
  useEffect(() => setLocal(value ? String(value) : ""), [value]);
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</label>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value.replace(/\D/g, ""))}
        onBlur={() => onCommit(local ? Number(local) : undefined)}
        inputMode="numeric"
        placeholder="0"
        className="h-10 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
      />
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "brand-gradient" : "bg-white/10")}>
      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </button>
  );
}

"use client";

import { useState } from "react";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { ImportListConfig, ImportListKind } from "@/lib/importLists/types";
import { Loader2, Plus, Trash2, RefreshCw, Check, ExternalLink, List } from "lucide-react";

const KIND_OPTIONS: { value: ImportListKind; label: string; icon: string }[] = [
  { value: "trakt", label: "Trakt", icon: "T" },
  { value: "imdb", label: "IMDb", icon: "I" },
  { value: "letterboxd", label: "Letterboxd", icon: "L" },
];

export function ImportListsSettings() {
  const t = useT();
  const { data, mutate } = useSWR<{ lists: ImportListConfig[] }>("/api/import-lists");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", kind: "trakt" as ImportListKind, url: "", autoApprove: false });
  const lists = data?.lists ?? [];

  const create = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/import-lists", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: `il_${Date.now().toString(36)}`,
          name: form.name.trim(),
          kind: form.kind,
          url: form.url.trim(),
          enabled: true,
          autoApprove: form.autoApprove,
          lastSync: null,
        }),
      });
      await mutate();
      setShowForm(false);
      setForm({ name: "", kind: "trakt", url: "", autoApprove: false });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    mutate((current) => current ? { lists: current.lists.filter((l) => l.id !== id) } : current, { revalidate: false });
    try {
      await fetch("/api/import-lists", {
        method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }),
      });
    } finally {
      await mutate();
    }
  };

  const sync = async (id: string) => {
    setSyncing(id);
    try {
      await fetch("/api/import-lists", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync", id }),
      });
      await mutate();
    } finally { setSyncing(null); }
  };

  const hrefHint: Record<string, string> = {
    trakt: "https://trakt.tv/users/me/lists",
    imdb: "https://www.imdb.com/list/ls...",
    letterboxd: "https://letterboxd.com/username/watchlist/",
  };

  return (
    <div className="space-y-4">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <List className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("settings.importLists")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("settings.importListsHint")}</p>
        </div>
      </div>

      {lists.length === 0 && !showForm && (
        <div className="rounded-2xl glass py-12 text-center">
          <List className="mx-auto mb-2 h-6 w-6 text-ink-dim" />
          <p className="font-semibold text-ink">{t("settings.noImportLists")}</p>
          <p className="mt-1 text-sm text-ink-dim">{t("settings.importListsHint")}</p>
        </div>
      )}
      {lists.map((l) => (
        <div key={l.id} className="flex items-center justify-between rounded-2xl glass p-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{l.name}</p>
            <p className="text-xs text-ink-dim">
              {l.kind.toUpperCase()} · {l.url}
              {l.lastSync && <> · {t("settings.lastSync")} {new Date(l.lastSync).toLocaleString()}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => sync(l.id)} disabled={syncing === l.id} className="flex h-8 w-8 items-center justify-center rounded-lg glass-strong text-ink-soft">
              {syncing === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => remove(l.id)} className="flex h-8 w-8 items-center justify-center rounded-lg glass-strong text-down">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="rounded-2xl glass p-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">{t("common.name")}</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">{t("common.type")}</label>
            <div className="flex gap-1 rounded-xl glass p-1 w-fit">
              {KIND_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setForm({ ...form, kind: opt.value })} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", form.kind === opt.value ? "brand-gradient text-white" : "text-ink-soft hover:text-ink")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-soft">
              {t("common.url")} <a href={hrefHint[form.kind]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand-glow"><ExternalLink className="h-3 w-3" /></a>
            </label>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={hrefHint[form.kind]} className="h-10 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="auto" checked={form.autoApprove} onChange={(e) => setForm({ ...form, autoApprove: e.target.checked })} className="h-4 w-4 accent-brand-glow" />
            <label htmlFor="auto" className="text-xs font-semibold text-ink-soft">{t("settings.autoApproveImports")}</label>
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={saving} className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-5 text-sm font-bold text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("common.add")}
            </button>
            <button onClick={() => setShowForm(false)} className="flex h-10 items-center rounded-xl glass px-5 text-sm font-semibold text-ink-soft">{t("common.cancel")}</button>
          </div>
        </div>
      )}

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="flex h-11 items-center gap-2 rounded-xl glass px-5 text-sm font-semibold text-ink-soft hover:text-ink">
          <Plus className="h-4 w-4" /> {t("settings.addImportList")}
        </button>
      )}
    </div>
  );
}

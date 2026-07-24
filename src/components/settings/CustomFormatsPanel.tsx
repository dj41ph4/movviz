"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { CustomFormat } from "@/lib/customFormats/types";
import { SlidersHorizontal, Plus, Trash2, X, Check, Loader2, Gauge } from "lucide-react";

export function CustomFormatsPanel() {
  const t = useT();
  const [formats, setFormats] = useState<CustomFormat[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = () =>
    fetch("/api/custom-formats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFormats(d.formats ?? []));

  useEffect(() => { load(); }, []);

  const toggle = async (cf: CustomFormat) => {
    setFormats((fs) => fs.map((f) => (f.id === cf.id ? { ...f, enabled: !f.enabled } : f)));
    await fetch(`/api/custom-formats/${cf.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !cf.enabled }),
    });
  };

  const remove = async (id: string) => {
    if (!confirm(t("customFormats.confirmRemove"))) return;
    await fetch(`/api/custom-formats/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Gauge className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("settings.tabQualite")}</h3>
          <p className="mt-0.5 max-w-3xl text-xs text-ink-dim">{t("customFormats.intro")}</p>
        </div>
      </div>

      <div className="space-y-2">
        {formats.map((cf) => (
          <div key={cf.id} className="flex items-center gap-4 rounded-2xl glass p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-bold text-ink">{cf.i18nKey ? t(cf.i18nKey) : cf.name}</h3>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", cf.score >= 0 ? "bg-ok/12 text-ok" : "bg-down/12 text-down")}>
                  {cf.score >= 0 ? "+" : ""}{cf.score}
                </span>
              </div>
              <p className="truncate font-mono text-xs text-ink-dim">{cf.terms.join(", ")}</p>
            </div>
            <Toggle on={cf.enabled} onChange={() => toggle(cf)} />
            <button onClick={() => remove(cf.id)} className="flex h-9 w-9 items-center justify-center rounded-xl glass text-ink-dim transition-colors hover:bg-down/15 hover:text-down">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {formats.length === 0 && !showForm && (
          <div className="rounded-2xl glass py-12 text-center">
            <p className="font-semibold text-ink">{t("customFormats.none")}</p>
          </div>
        )}

        <AnimatePresence>
          {showForm && <AddForm onDone={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
        </AnimatePresence>

        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-4 text-sm font-semibold text-ink-dim transition-colors hover:border-brand/40 hover:text-brand-glow">
            <Plus className="h-4 w-4" /> {t("customFormats.add")}
          </button>
        )}
      </div>
    </div>
  );
}

function AddForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [score, setScore] = useState("10");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);

  const field = "w-full rounded-xl glass-strong px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-dim";

  const save = async () => {
    const termList = terms.split(",").map((s) => s.trim()).filter(Boolean);
    if (!name.trim() || termList.length === 0) return;
    setSaving(true);
    try {
      await fetch("/api/custom-formats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), score: Number(score) || 0, terms: termList }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="rounded-2xl glass-strong p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-ink">{t("customFormats.add")}</h3>
          <button onClick={onCancel} className="text-ink-dim hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("customFormats.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("customFormats.score")}</label>
            <input value={score} onChange={(e) => setScore(e.target.value.replace(/[^-\d]/g, ""))} inputMode="numeric" className={field} />
          </div>
          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("customFormats.terms")}</label>
            <input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={t("customFormats.termsHint")} className={cn(field, "font-mono text-xs")} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-3">
            <button onClick={onCancel} className="glass-strong text-ink-soft h-10 px-4 rounded-xl font-semibold text-sm"></button>
            <button onClick={save} disabled={saving || !name.trim() || !terms.trim()} className="brand-gradient text-white h-10 px-4 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-40">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t("indexerMgr.save")}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "brand-gradient" : "bg-white/10")}>
      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </button>
  );
}

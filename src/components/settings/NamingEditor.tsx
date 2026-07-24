"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { TOKEN_DEFS } from "@/lib/naming/tokens";
import type { NamingTemplates } from "@/lib/naming/types";
import { DEFAULT_TEMPLATES } from "@/lib/naming/defaults";
import { Film, Tv, Check, Loader2, RotateCcw, Eye } from "lucide-react";

type FieldKey = "movieFolder" | "movieFile" | "seriesFolder" | "seasonFolder" | "episodeFile";

export function NamingEditor() {
  const t = useT();
  const [templates, setTemplates] = useState<NamingTemplates>(DEFAULT_TEMPLATES);
  const [preview, setPreview] = useState<{ movie: string; episode: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const focusedField = useRef<FieldKey | null>(null);
  const cursorPos = useRef<number>(0);

  useEffect(() => {
    fetch("/api/naming", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setTemplates(d); setLoaded(true); });
  }, []);

  // Live preview, debounced-by-effect on template changes.
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      fetch("/api/naming/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(templates),
      })
        .then((r) => r.json())
        .then(setPreview)
        .catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [templates, loaded]);

  const set = (k: FieldKey | "useDotsInsteadOfSpaces" | "enabled", v: unknown) =>
    setTemplates((p) => ({ ...p, [k]: v }));

  const insertToken = (key: string) => {
    const field = focusedField.current;
    if (!field) return;
    const token = `{${key}}`;
    setTemplates((p) => {
      const current = p[field] as string;
      const pos = cursorPos.current ?? current.length;
      const next = current.slice(0, pos) + token + current.slice(pos);
      return { ...p, [field]: next };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/naming", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(templates),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl glass p-5 space-y-4">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Film className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("naming.title")}</h3>
          <p className="mt-0.5 max-w-3xl text-xs text-ink-dim">{t("naming.intro")}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl glass p-4">
        <span className="flex-1 text-sm font-semibold text-ink">
          {t("naming.enable")}
          <span className="mt-0.5 block text-xs font-normal text-ink-dim">{t("naming.enableHint")}</span>
        </span>
        <button
          onClick={() => set("enabled", !templates.enabled)}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", templates.enabled ? "brand-gradient" : "bg-white/10")}
        >
          <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", templates.enabled && "translate-x-5")} />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl glass p-5">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-ink">
            <Film className="h-4 w-4 text-brand-glow" /> {t("naming.moviesSection")}
          </h3>
          <div className="space-y-4">
            <Field label={t("naming.movieFolder")} value={templates.movieFolder}
              onChange={(v) => set("movieFolder", v)}
              onFocus={() => (focusedField.current = "movieFolder")}
              onCursor={(p) => (cursorPos.current = p)} />
            <Field label={t("naming.movieFile")} value={templates.movieFile}
              onChange={(v) => set("movieFile", v)}
              onFocus={() => (focusedField.current = "movieFile")}
              onCursor={(p) => (cursorPos.current = p)} />
          </div>
          {preview && (
            <PreviewLine icon={Eye} value={preview.movie} />
          )}
        </section>

        <section className="rounded-2xl glass p-5">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-ink">
            <Tv className="h-4 w-4 text-cyan" /> {t("naming.seriesSection")}
          </h3>
          <div className="space-y-4">
            <Field label={t("naming.seriesFolder")} value={templates.seriesFolder}
              onChange={(v) => set("seriesFolder", v)}
              onFocus={() => (focusedField.current = "seriesFolder")}
              onCursor={(p) => (cursorPos.current = p)} />
            <Field label={t("naming.seasonFolder")} value={templates.seasonFolder}
              onChange={(v) => set("seasonFolder", v)}
              onFocus={() => (focusedField.current = "seasonFolder")}
              onCursor={(p) => (cursorPos.current = p)} />
            <Field label={t("naming.episodeFile")} value={templates.episodeFile}
              onChange={(v) => set("episodeFile", v)}
              onFocus={() => (focusedField.current = "episodeFile")}
              onCursor={(p) => (cursorPos.current = p)} />
          </div>
          {preview && (
            <PreviewLine icon={Eye} value={preview.episode} />
          )}
        </section>
      </div>

      {/* Token reference */}
      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("naming.tokens")}</h3>
        <p className="mb-3 text-xs text-ink-dim">{t("naming.tokenInsertHint")} · {t("naming.padHint")}</p>
        <div className="flex flex-wrap gap-2">
          {TOKEN_DEFS.map((tok) => (
            <button
              key={tok.key}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertToken(tok.key)}
              title={`${t(tok.labelKey)} — e.g. ${t(tok.exampleKey)}`}
              className="rounded-lg border border-white/8 bg-black/30 px-2.5 py-1.5 font-mono text-xs text-ink-soft transition-colors hover:border-brand/40 hover:text-brand-glow"
            >
              {`{${tok.key}${tok.paddable ? ":00" : ""}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={templates.useDotsInsteadOfSpaces} onChange={(e) => set("useDotsInsteadOfSpaces", e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
          {t("naming.dotsOption")}
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setTemplates(DEFAULT_TEMPLATES)} className="glass-strong text-ink-soft h-10 px-4 rounded-xl font-semibold text-sm flex items-center gap-1.5">
            <RotateCcw className="h-4 w-4" /> {t("naming.reset")}
          </button>
          <button onClick={save} disabled={saving} className="brand-gradient text-white h-10 px-4 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saved ? t("naming.saved") : t("naming.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, onFocus, onCursor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onCursor: (pos: number) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</label>
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); onCursor(e.target.selectionStart ?? e.target.value.length); }}
        onFocus={onFocus}
        onKeyUp={(e) => onCursor((e.target as HTMLInputElement).selectionStart ?? 0)}
        onClick={(e) => onCursor((e.target as HTMLInputElement).selectionStart ?? 0)}
        className="w-full rounded-xl glass-strong px-3 py-2.5 font-mono text-xs text-ink outline-none"
      />
    </div>
  );
}

function PreviewLine({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-ink-dim" />
      <code className="truncate text-xs text-ok">{value}</code>
    </div>
  );
}

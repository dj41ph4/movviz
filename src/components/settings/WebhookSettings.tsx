"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Send, Loader2 } from "lucide-react";

export function WebhookSettings() {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/webhook", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setEnabled(d.enabled);
          setUrl(d.url);
        }
      });
  }, []);

  const save = async (next: { enabled?: boolean; url?: string }) => {
    setSaving(true);
    try {
      const body = { enabled, url, ...next };
      await fetch("/api/webhook", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if ("enabled" in next) setEnabled(next.enabled!);
      if ("url" in next) setUrl(next.url!);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/webhook/test", { method: "POST" });
      setTestMsg(res.ok ? t("webhooks.testSent") : t("webhooks.testFailed"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Send className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("webhooks.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("webhooks.intro")}</p>
        </div>
      </div>

      <label className="mb-4 flex items-center gap-3">
        <button
          onClick={() => save({ enabled: !enabled })}
          className={cn("relative h-6 w-11 rounded-full transition-colors", enabled ? "brand-gradient" : "bg-white/10")}
        >
          <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", enabled && "translate-x-5")} />
        </button>
        <span className="text-sm font-semibold text-ink">{t("webhooks.enable")}</span>
      </label>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("webhooks.url")}</label>
        <div className="flex gap-2">
          <input
            value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => save({ url })}
          placeholder="https://discord.com/api/webhooks/…"
          className="h-11 flex-1 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
        />
        <button
          onClick={test}
          disabled={testing || !url}
          className="flex h-11 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft disabled:opacity-40"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t("webhooks.test")}
        </button>
      </div>
      </div>
      {testMsg && <p className="mt-2 text-xs text-ink-dim">{testMsg}</p>}
      {saving && <p className="mt-2 text-xs text-ink-dim">{t("settings.saved")}</p>}
    </div>
  );
}

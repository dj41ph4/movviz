"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { Send, Loader2, Check, X } from "lucide-react";

/** Styled to match NotificationSettings' transport cards exactly — rendered
 *  as one more card in that same stack (see NotificationSettings.tsx) so a
 *  generic webhook reads as a 6th delivery transport alongside Discord/
 *  Telegram/Gotify/Slack/Pushbullet, not a bolted-on separate feature. Kept
 *  as its own component/API (/api/webhook) rather than folded into
 *  NotificationTransportConfig — different backend shape, no reason to
 *  entangle them just for a shared visual.
 */
export function WebhookSettings() {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

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
    const body = { enabled, url, ...next };
    await fetch("/api/webhook", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if ("enabled" in next) setEnabled(next.enabled!);
    if ("url" in next) setUrl(next.url!);
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/webhook/test", { method: "POST" });
      setTestResult(res.ok);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 font-semibold text-ink">
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => save({ enabled: !enabled })}
            className="h-4 w-4 accent-brand-glow"
          />
          {t("webhooks.title")}
        </label>
        <button
          onClick={test}
          disabled={testing || !url}
          className="flex h-8 items-center gap-1.5 rounded-lg glass-strong px-3 text-xs font-semibold text-ink-soft disabled:opacity-40"
        >
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {t("settings.test")}
        </button>
      </div>
      {testResult != null && (
        <div className={`mb-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${testResult ? "bg-ok/12 text-ok" : "bg-down/12 text-down"}`}>
          {testResult ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {testResult ? t("settings.testSuccess") : t("settings.testFailed")}
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-semibold text-ink-soft">{t("webhooks.url")}</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => save({ url })}
          placeholder="https://discord.com/api/webhooks/…"
          className="h-10 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
        />
      </div>
    </div>
  );
}

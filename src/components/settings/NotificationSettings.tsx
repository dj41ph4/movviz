"use client";

import { useState } from "react";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import type { NotificationTransportConfig } from "@/lib/notifications/types";
import { Loader2, Check, X, Send } from "lucide-react";

type TransportKind = "discord" | "telegram" | "gotify" | "slack" | "pushbullet";

const TRANSPORTS: { kind: TransportKind; fields: { key: string; labelKey: string; secret?: boolean; placeholder: string }[] }[] = [
  {
    kind: "discord",
    fields: [
      { key: "webhookUrl", labelKey: "notifications.transport.webhookUrl", placeholder: "https://discord.com/api/webhooks/..." },
    ],
  },
  {
    kind: "telegram",
    fields: [
      { key: "botToken", labelKey: "notifications.transport.botToken", secret: true, placeholder: "123456:ABC-DEF..." },
      { key: "chatId", labelKey: "notifications.transport.chatId", placeholder: "-1001234567890" },
    ],
  },
  {
    kind: "gotify",
    fields: [
      { key: "serverUrl", labelKey: "notifications.transport.serverUrl", placeholder: "https://gotify.example.com" },
      { key: "appToken", labelKey: "notifications.transport.appToken", secret: true, placeholder: "AbCdEf..." },
    ],
  },
  {
    kind: "slack",
    fields: [
      { key: "webhookUrl", labelKey: "notifications.transport.webhookUrl", placeholder: "https://hooks.slack.com/services/..." },
    ],
  },
  {
    kind: "pushbullet",
    fields: [
      { key: "apiToken", labelKey: "notifications.transport.apiToken", secret: true, placeholder: "o.abc123..." },
    ],
  },
];

export function NotificationSettings() {
  const t = useT();
  const { data, mutate } = useSWR<NotificationTransportConfig>("/api/notifications/config");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<TransportKind | null>(null);
  const [testResult, setTestResult] = useState<{ kind: TransportKind; ok: boolean } | null>(null);
  const [draft, setDraft] = useState<NotificationTransportConfig | null>(null);

  const cfg = draft ?? data;

  const setField = (kind: TransportKind, key: string, value: string) => {
    setDraft((prev) => {
      const base = prev ?? data ?? {} as NotificationTransportConfig;
      return { ...base, [kind]: { ...base[kind], [key]: value } };
    });
  };

  const toggleEnabled = (kind: TransportKind) => {
    setDraft((prev) => {
      const base = prev ?? data ?? {} as NotificationTransportConfig;
      return { ...base, [kind]: { ...base[kind], enabled: !base[kind]?.enabled } };
    });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await fetch("/api/notifications/config", {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft),
      });
      await mutate();
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  const test = async (kind: TransportKind) => {
    setTesting(kind);
    setTestResult(null);
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }),
      });
      const { ok } = await res.json();
      setTestResult({ kind, ok });
    } finally {
      setTesting(null);
    }
  };

  if (!cfg) return <div className="flex items-center justify-center gap-2 py-8 text-ink-dim"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-dim">{t("settings.notificationsHint")}</p>

      {TRANSPORTS.map(({ kind, fields }) => {
        const transport = cfg[kind];
        return (
          <div key={kind} className="rounded-2xl glass p-5">
            <div className="mb-4 flex items-center justify-between">
              <label className="flex items-center gap-2 font-semibold text-ink">
                <input type="checkbox" checked={transport?.enabled ?? false} onChange={() => toggleEnabled(kind)} className="h-4 w-4 accent-brand-glow" />
                {t("notifications.transport." + kind)}
              </label>
              <button
                onClick={() => test(kind)}
                disabled={testing === kind || !transport?.enabled}
                className="flex h-8 items-center gap-1.5 rounded-lg glass-strong px-3 text-xs font-semibold text-ink-soft disabled:opacity-40"
              >
                {testing === kind ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {t("settings.test")}
              </button>
            </div>
            {testResult && testResult.kind === kind && (
              <div className={`mb-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${testResult.ok ? "bg-ok/12 text-ok" : "bg-down/12 text-down"}`}>
                {testResult.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {testResult.ok ? t("settings.testSuccess") : t("settings.testFailed")}
              </div>
            )}
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-semibold text-ink-soft">{t(f.labelKey)}</label>
                  <input
                    value={(transport as any)?.[f.key] ?? ""}
                    onChange={(e) => setField(kind, f.key, e.target.value)}
                    type={f.secret ? "password" : "text"}
                    placeholder={f.placeholder}
                    className="h-10 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {draft && (
        <button
          onClick={save}
          disabled={saving}
          className="flex h-11 items-center gap-2 rounded-xl brand-gradient px-6 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("common.save")}
        </button>
      )}
    </div>
  );
}

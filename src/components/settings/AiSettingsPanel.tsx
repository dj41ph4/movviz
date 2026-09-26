"use client";

import { useEffect, useState } from "react";
import { mutate } from "swr";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";
import { Bot, Loader2, Plus, Trash2 } from "lucide-react";
import { AI_PROVIDERS, type AiProviderId } from "@/lib/ai/types";
import { GEMINI_RECOMMENDED_MODELS } from "@/lib/ai/freeModels";
import { AiDebugLogPanel } from "@/components/settings/AiDebugLogPanel";

const PROVIDERS = AI_PROVIDERS;

/** Where to grab a free key for each provider — plain URLs, no translation needed. */
const PROVIDER_KEY_URL: Record<AiProviderId, string> = {
  gemini: "https://aistudio.google.com/apikey",
};

/** Shown until the server's list arrives (and if it can't be reached). */
const BUILTIN_MODELS: Record<AiProviderId, { id: string; label: string }[]> = {
  gemini: [...GEMINI_RECOMMENDED_MODELS],
};

interface KeyRow {
  id: string;
  /** When false, the stored key is kept on save (never shown again). */
  isNew: boolean;
  /** Only meaningful when isNew — the freshly typed key. */
  value: string;
}

interface ProviderDraft {
  model: string;
  keys: KeyRow[];
}

interface ConfigDraft {
  enabled: boolean;
  primary: AiProviderId;
  webSearchEnabled: boolean;
  voiceInputEnabled: boolean;
  voiceOutputEnabled: boolean;
  /** Which system prompt the chat uses — full by default. */
  promptVariant: "full" | "compact";
  /** Whether a Tavily key is stored server-side (the key itself never comes back). */
  hasWebSearchKey: boolean;
  /** A newly typed Tavily key, sent on save; empty = keep the stored one. */
  webSearchKeyInput: string;
  clearWebSearchKey: boolean;
  providers: Record<AiProviderId, ProviderDraft>;
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const t = useT();
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
      role="switch"
      aria-checked={checked}
    >
      <span>
        <span className="text-sm font-bold text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-ink-dim">{hint}</span> : null}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-white/12")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function AiSettingsPanel({ showDebugLog = true }: { showDebugLog?: boolean } = {}) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<ConfigDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<AiProviderId | null>(null);
  const [testResult, setTestResult] = useState<{ provider: AiProviderId; ok: boolean; detail?: string; latency?: number; message?: string } | null>(null);
  const [modelsChecked, setModelsChecked] = useState(false);
  const [freeModels, setFreeModels] = useState<Record<AiProviderId, { id: string; label: string }[]>>(BUILTIN_MODELS);

  useEffect(() => {
    (async () => {
      try {
        // Bug fix: a non-2xx response (403 without an admin session — the
        // wizard reaching this step before an account exists, a stale
        // cookie, ...) used to `return` here WITHOUT ever calling
        // setLoaded(true), leaving this panel stuck on its spinner forever
        // with no way to recover short of a full reload.
        const r = await fetch("/api/ai/config", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          const providers = {} as Record<AiProviderId, ProviderDraft>;
          for (const id of PROVIDERS) {
            providers[id] = {
              model: d.providers?.[id]?.model ?? "",
              keys: (d.providers?.[id]?.keys ?? []).map((k: { id: string }) => ({ id: k.id, isNew: false, value: "" })),
            };
          }
          const primary: AiProviderId = PROVIDERS.includes(d.primary) ? d.primary : PROVIDERS[0];
          setDraft({ enabled: !!d.enabled, primary, webSearchEnabled: !!d.webSearchEnabled, voiceInputEnabled: !!d.voiceInputEnabled, voiceOutputEnabled: !!d.voiceOutputEnabled, promptVariant: d.promptVariant === "compact" ? "compact" : "full", hasWebSearchKey: !!d.hasWebSearchKey, webSearchKeyInput: "", clearWebSearchKey: false, providers });
        }
      } catch { /* leave unloaded */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/ai/free-models", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.providers || typeof payload.providers !== "object") return;
        const next = {} as Record<AiProviderId, { id: string; label: string }[]>;
        for (const provider of PROVIDERS) {
          const models = payload.providers[provider];
          next[provider] = Array.isArray(models)
            ? models.filter((model: unknown): model is { id: string; label: string } => !!model && typeof (model as { id?: unknown }).id === "string" && typeof (model as { label?: unknown }).label === "string")
            : BUILTIN_MODELS[provider];
        }
        setFreeModels(next);
      } catch {
        // The safe built-in free fallback remains visible.
      } finally {
        setModelsChecked(true);
      }
    })();
  }, []);

  // The Gemini list only holds models that really answered with the stored
  // key: a setting left on a model Google has since refused (e.g. the 2.5
  // range) is moved to the first working one, which « Enregistrer » persists.
  useEffect(() => {
    if (!draft || !modelsChecked) return;
    let providers: ConfigDraft["providers"] | null = null;
    for (const provider of PROVIDERS) {
      const list = freeModels[provider];
      if (list.length && !list.some((model) => model.id === draft.providers[provider].model)) {
        providers ??= { ...draft.providers };
        providers[provider] = { ...draft.providers[provider], model: list[0].id };
      }
    }
    if (providers) setDraft({ ...draft, providers });
  }, [draft, freeModels, modelsChecked]);

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 rounded-2xl glass p-5 text-sm text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("ai.settings.loading")}
      </div>
    );
  }
  if (!draft) return null;

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        enabled: draft.enabled,
        primary: draft.primary,
        webSearchEnabled: draft.webSearchEnabled,
        voiceInputEnabled: draft.voiceInputEnabled,
        voiceOutputEnabled: draft.voiceOutputEnabled,
        promptVariant: draft.promptVariant,
        webSearchKey: draft.webSearchKeyInput.trim(),
        clearWebSearchKey: draft.clearWebSearchKey,
        providers: Object.fromEntries(
          PROVIDERS.map((id) => [
            id,
            {
              model: draft.providers[id].model.trim(),
              keys: draft.providers[id].keys.map((k) => ({ id: k.id, key: k.isNew ? k.value.trim() : "" })),
            },
          ])
        ),
      };
      const r = await fetch("/api/ai/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const d = await r.json();
        const providers = {} as Record<AiProviderId, ProviderDraft>;
        for (const id of PROVIDERS) {
          providers[id] = {
            model: d.providers?.[id]?.model ?? draft.providers[id].model,
            keys: (d.providers?.[id]?.keys ?? []).map((k: { id: string }) => ({ id: k.id, isNew: false, value: "" })),
          };
        }
        setDraft({ enabled: d.enabled, primary: d.primary, webSearchEnabled: !!d.webSearchEnabled, voiceInputEnabled: !!d.voiceInputEnabled, voiceOutputEnabled: !!d.voiceOutputEnabled, promptVariant: d.promptVariant === "compact" ? "compact" : "full", hasWebSearchKey: !!d.hasWebSearchKey, webSearchKeyInput: "", clearWebSearchKey: false, providers });
        setTestResult(null);
        toast("success", t("ai.settings.saved"));
        // The floating chat button reads its own "enabled" via SWR on
        // /api/ai/session — without this, toggling AI on/off here would
        // only take effect for the widget after a full page reload.
        mutate("/api/ai/session");
      } else {
        toast("error", t("ai.settings.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const test = async (provider: AiProviderId) => {
    setTesting(provider);
    setTestResult(null);
    try {
      const r = await fetch("/api/ai/config/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const d = await r.json().catch(() => null);
      setTestResult({ provider, ok: !!d?.ok, detail: d?.detail, latency: d?.latency, message: typeof d?.message === "string" && d.message ? d.message : undefined });
    } catch {
      setTestResult({ provider, ok: false, detail: "network" });
    } finally {
      setTesting(null);
    }
  };

  const addKey = (provider: AiProviderId) => {
    const keys = [...draft.providers[provider].keys, { id: `new_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, isNew: true, value: "" }];
    setDraft({ ...draft, providers: { ...draft.providers, [provider]: { ...draft.providers[provider], keys } } });
  };

  const setKeyValue = (provider: AiProviderId, keyId: string, value: string) => {
    setDraft({
      ...draft,
      providers: {
        ...draft.providers,
        [provider]: { ...draft.providers[provider], keys: draft.providers[provider].keys.map((k) => (k.id === keyId ? { ...k, value } : k)) },
      },
    });
  };

  const removeKey = (provider: AiProviderId, id: string) => {
    setDraft({ ...draft, providers: { ...draft.providers, [provider]: { ...draft.providers[provider], keys: draft.providers[provider].keys.filter((k) => k.id !== id) } } });
  };

  const setModel = (provider: AiProviderId, model: string) => {
    setDraft({ ...draft, providers: { ...draft.providers, [provider]: { ...draft.providers[provider], model } } });
  };

  const hasAnyKey = PROVIDERS.some((id) => draft.providers[id].keys.length > 0);

  return (
    <div className="space-y-5">
    <div className="rounded-2xl glass p-5">
      {/* Save button ALSO up here, not just at the bottom of the provider
          list — after just flipping the enable switch or pasting a key,
          the user shouldn't have to scroll past 3 provider cards to find
          it. The bottom one stays too (useful once you're already down
          there after configuring a provider). */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-ink">{t("ai.settings.title")}</h3>
            <p className="mt-0.5 text-xs text-ink-dim">{t("ai.settings.intro")}</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving || !draft.enabled || !hasAnyKey}
          className="brand-gradient flex h-10 shrink-0 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("ai.settings.save")}
        </button>
      </div>

      <div className="space-y-6">
        <Switch
          checked={draft.enabled}
          onChange={(v) => setDraft({ ...draft, enabled: v })}
          label={t("ai.settings.enabled")}
          hint={t("ai.settings.enabledHint")}
        />

        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-ink">{t("ai.settings.promptVariant")}</p>
            <p className="mt-0.5 text-xs text-ink-dim">{t("ai.settings.promptVariantHint")}</p>
          </div>
          <div className="flex gap-1 rounded-xl glass p-0.5">
            {(["full", "compact"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setDraft({ ...draft, promptVariant: v })}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  draft.promptVariant === v ? "brand-gradient text-white shadow" : "text-ink-dim hover:text-ink"
                )}
              >
                {v === "full" ? t("ai.settings.promptFull") : t("ai.settings.promptCompact")}
              </button>
            ))}
          </div>
        </div>

        <Switch
          checked={draft.voiceInputEnabled}
          onChange={(v) => setDraft({ ...draft, voiceInputEnabled: v })}
          label={t("ai.settings.voiceInput")}
          hint={t("ai.settings.voiceInputHint")}
        />
        <Switch
          checked={draft.voiceOutputEnabled}
          onChange={(v) => setDraft({ ...draft, voiceOutputEnabled: v })}
          label={t("ai.settings.voiceOutput")}
          hint={t("ai.settings.voiceOutputHint")}
        />

        <Switch
          checked={draft.webSearchEnabled}
          onChange={(v) => setDraft({ ...draft, webSearchEnabled: v })}
          label={t("ai.settings.webSearch")}
          hint={t("ai.settings.webSearchHint")}
        />
        {draft.webSearchEnabled ? (
          <div className="-mt-2 rounded-xl glass p-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-dim">{t("ai.settings.webSearchKey")}</label>
            {draft.hasWebSearchKey && !draft.clearWebSearchKey ? (
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="rounded-full border border-ok/30 bg-ok/12 px-2.5 py-0.5 text-[11px] font-bold text-ok">{t("ai.settings.webSearchKeySaved")}</span>
                <button
                  onClick={() => setDraft({ ...draft, clearWebSearchKey: true, webSearchKeyInput: "" })}
                  className="text-xs font-semibold text-ink-dim hover:text-down"
                >
                  {t("ai.settings.webSearchKeyRemove")}
                </button>
              </div>
            ) : null}
            <input
              type="password"
              value={draft.webSearchKeyInput}
              onChange={(e) => setDraft({ ...draft, webSearchKeyInput: e.target.value, clearWebSearchKey: false })}
              placeholder={t("ai.settings.webSearchKeyPlaceholder")}
              autoComplete="off"
              className="h-11 w-full rounded-xl glass-strong px-3 text-sm text-ink outline-none placeholder:text-ink-dim"
            />
            <a href="https://app.tavily.com" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-brand-glow hover:underline">
              {t("ai.settings.webSearchKeyGet")}
            </a>
          </div>
        ) : null}

        <div className="border-t border-white/5 pt-5">
          <p className="mb-3 text-sm font-bold text-ink">{t("ai.settings.providers")}</p>
          <div className="space-y-4">
            {PROVIDERS.map((id) => {
              const p = draft.providers[id];
              const testingThis = testing === id;
              const result = testResult?.provider === id ? testResult : null;
              return (
                <div key={id} className="rounded-xl border border-white/8 bg-black/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-ink">{t(`ai.provider.${id}`)}</p>
                    <button
                      onClick={() => test(id)}
                      disabled={testingThis || p.keys.length === 0}
                      className="glass-strong flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
                    >
                      {testingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      {t("ai.settings.test")}
                    </button>
                  </div>

                  <p className="mb-3 text-xs text-ink-dim">
                    {t(`ai.provider.${id}Hint`)} — {t("ai.settings.getKeyPrefix")}{" "}
                    <a
                      href={PROVIDER_KEY_URL[id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand-glow hover:underline"
                    >
                      {PROVIDER_KEY_URL[id].replace(/^https?:\/\//, "")}
                    </a>
                  </p>

                  <div className="mb-3">
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-dim">
                      {t("ai.settings.model")}
                    </label>
                    {id === "gemini" && !modelsChecked && p.keys.some((k) => !k.isNew) ? (
                      <p className="flex h-11 items-center gap-2 text-sm text-ink-soft">
                        <Loader2 className="h-4 w-4 animate-spin" /> {t("ai.settings.modelsChecking")}
                      </p>
                    ) : id === "gemini" && freeModels.gemini.length === 0 ? (
                      <p className="flex min-h-11 items-center text-sm text-ink-soft">{t("ai.settings.noWorkingModel")}</p>
                    ) : (
                      <select
                        value={p.model}
                        onChange={(e) => setModel(id, e.target.value)}
                        className="h-11 w-full rounded-xl glass-strong px-3 text-sm text-ink outline-none"
                      >
                        {freeModels[id].map((model) => (
                          <option key={model.id} value={model.id} className="bg-surface text-ink">
                            {model.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-dim">
                      {t("ai.settings.keys")}
                    </label>
                    <div className="space-y-1.5">
                      {p.keys.map((k) => (
                        <div key={k.id} className="flex items-center gap-2">
                          {k.isNew ? (
                            <input
                              value={k.value}
                              onChange={(e) => setKeyValue(id, k.id, e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && save()}
                              placeholder={t("ai.settings.keyPlaceholder")}
                              autoFocus
                              className="min-w-0 flex-1 rounded-lg bg-white/4 px-3 py-2 text-sm font-mono text-ink outline-none placeholder:text-ink-dim ring-focus"
                            />
                          ) : (
                            <span className="min-w-0 flex-1 break-all rounded-lg bg-white/4 px-3 py-2 text-sm font-mono text-ink-soft">
                              ••••••••••••••••
                            </span>
                          )}
                          <button
                            onClick={() => removeKey(id, k.id)}
                            title={t("ai.settings.removeKey")}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-white/8 hover:text-down"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      {p.keys.length === 0 ? (
                        <p className="rounded-lg bg-amber/10 px-3 py-2 text-xs text-amber">{t("ai.settings.noKeys")}</p>
                      ) : null}
                      <button
                        onClick={() => addKey(id)}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 text-xs font-bold text-ink-soft transition-colors hover:border-brand/40 hover:text-brand-glow"
                      >
                        <Plus className="h-3.5 w-3.5" /> {t("ai.settings.addKey")}
                      </button>
                    </div>
                  </div>

                  {result ? (
                    <p className={cn("mt-2 text-xs font-semibold", result.ok ? "text-ok" : "text-down")}>
                      {result.ok
                        ? t("ai.settings.testOk", { latency: String(result.latency ?? 0) })
                        : result.detail === "no_keys"
                          ? t("ai.settings.testNoKeys")
                          : <>{result.detail === "quota" ? t("ai.settings.testQuota") : t("ai.settings.testFail")}{result.message ? <span className="font-mono opacity-80"> — {result.message}</span> : null}</>}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-5">
          <button
            onClick={save}
            disabled={saving || !draft.enabled || !hasAnyKey}
            className="brand-gradient flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("ai.settings.save")}
          </button>
          {!hasAnyKey && <p className="text-xs text-ink-dim">{t("ai.settings.saveHint")}</p>}
        </div>
      </div>
    </div>

    {showDebugLog && <AiDebugLogPanel />}
    </div>
  );
}

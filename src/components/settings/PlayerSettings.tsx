"use client";

import { MonitorPlay, Bug, Gauge } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";
import { usePreferredAudioLanguage } from "@/lib/settings/usePreferredAudioLanguage";
import { PREFERRED_AUDIO_LANGUAGES, type PreferredAudioLanguage } from "@/lib/userPrefs/languages";
import { Toggle } from "@/components/ui/Toggle";
import { BenchmarkPanel } from "@/components/settings/BenchmarkPanel";

export function PlayerSettings() {
  const t = useT();
  const user = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const {
    adminEnabled,
    userEnabled,
    streamCacheTtl,
    hdrDvToSdrEnabled,
    debug,
    setAdminEnabled,
    setUserEnabled,
    setStreamCacheTtl,
    setHdrDvToSdrEnabled,
    setDebug,
  } = useBetaPlayer();
  const { value: preferredAudioLanguage, set: setPreferredAudioLanguage } = usePreferredAudioLanguage();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl glass p-5">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/12 text-purple-400">
            <MonitorPlay className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-ink">{t("player.unifiedTitle")}</h3>
            <p className="mt-0.5 text-xs text-ink-dim">{t("player.unifiedHint")}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">{t("player.useMovviz")}</p>
            <p className="text-xs text-ink-dim">{t("player.useMovvizHint")}</p>
          </div>
          <Toggle on={userEnabled} onChange={() => setUserEnabled(!userEnabled)} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
          <div>
            <p className="text-sm font-semibold text-ink">{t("player.preferredAudioLanguage")}</p>
            <p className="text-xs text-ink-dim">{t("player.preferredAudioLanguageHint")}</p>
          </div>
          <select value={preferredAudioLanguage} onChange={(e) => setPreferredAudioLanguage(e.target.value as PreferredAudioLanguage)} className="h-9 shrink-0 rounded-xl glass px-3 text-xs font-semibold text-ink outline-none focus:border-brand/40">
            {PREFERRED_AUDIO_LANGUAGES.map((l) => <option key={l} value={l}>{t(`player.audioLang.${l}`)}</option>)}
          </select>
        </div>

        <div className="mt-4 rounded-xl border border-brand/15 bg-brand/5 p-3">
          <p className="text-sm font-semibold text-ink">{t("player.autoEngine")}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-dim">{t("player.autoEngineHint")}</p>
        </div>
      </div>

      {isAdmin && (
        <div className="rounded-2xl glass p-5">
          <div className="mb-4 flex items-start gap-3">
            <Gauge className="mt-0.5 h-5 w-5 text-brand-glow" />
            <div><h3 className="font-bold text-ink">{t("player.serverTitle")}</h3><p className="text-xs text-ink-dim">{t("player.serverHint")}</p></div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-ink">{t("player.serverEnabled")}</p><p className="text-xs text-ink-dim">{t("player.serverEnabledHint")}</p></div>
            <Toggle on={adminEnabled} onChange={() => setAdminEnabled(!adminEnabled)} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
            <div>
              <p className="text-sm font-semibold text-ink">Conversion HDR / Dolby Vision → SDR</p>
              <p className="max-w-2xl text-xs leading-relaxed text-ink-dim">
                Couvre HDR10, HDR10+, HLG et Dolby Vision. Activé : le tonemapping reste autorisé uniquement si le benchmark réel atteint au moins 3×. Désactivé : aucune conversion vers SDR n'est permise, même avec un benchmark supérieur à 3×.
              </p>
            </div>
            <Toggle on={hdrDvToSdrEnabled} onChange={() => setHdrDvToSdrEnabled(!hdrDvToSdrEnabled)} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
            <div><p className="text-sm font-semibold text-ink">{t("player.bufferTtl")}</p><p className="text-xs text-ink-dim">{t("player.bufferTtlHint")}</p></div>
            <div className="flex items-center gap-2"><input type="number" min={0} max={86400} value={streamCacheTtl} onChange={(e) => setStreamCacheTtl(parseInt(e.target.value) || 0)} className="h-9 w-24 rounded-xl glass px-3 text-xs text-ink outline-none" /><span className="text-xs text-ink-dim">s</span></div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
            <div className="flex items-start gap-2"><Bug className="mt-0.5 h-4 w-4 text-ink-dim" /><div><p className="text-sm font-semibold text-ink">{t("player.debugToggle")}</p><p className="text-xs text-ink-dim">{t("player.debugToggleHint")}</p></div></div>
            <Toggle on={debug} onChange={() => setDebug(!debug)} />
          </div>
        </div>
      )}

      {isAdmin && <BenchmarkPanel />}
    </div>
  );
}

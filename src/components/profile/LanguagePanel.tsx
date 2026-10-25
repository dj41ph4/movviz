"use client";

import { Languages } from "lucide-react";
import { useT, useI18n } from "@/i18n/provider";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Toggle } from "@/components/ui/Toggle";
import { usePreferredAudioLanguage } from "@/lib/settings/usePreferredAudioLanguage";
import { useAutoSubtitles } from "@/lib/settings/useAutoSubtitles";
import { PREFERRED_AUDIO_LANGUAGES, type PreferredAudioLanguage } from "@/lib/userPrefs/languages";

/**
 * Langue du profil + ce qu'elle pilote : réglages PAR UTILISATEUR (stockés sur
 * le compte, jamais globaux) donc identiques sur toutes les plateformes.
 * La langue du profil est celle de l'interface (drapeaux) ; l'audio par défaut
 * la suit tant qu'il est sur « Automatique ».
 */
export function LanguagePanel() {
  const t = useT();
  const { locale } = useI18n();
  const { value: audioLanguage, set: setAudioLanguage } = usePreferredAudioLanguage();
  const { enabled: autoSubtitles, set: setAutoSubtitles } = useAutoSubtitles();

  return (
    <div className="mb-6 rounded-2xl glass p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Languages className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("profile.playbackTitle")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("profile.languageHint")}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{t("profile.languageLabel")}</p>
        <LanguageSwitcher />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
        <div>
          <p className="text-sm font-semibold text-ink">{t("player.preferredAudioLanguage")}</p>
          <p className="text-xs text-ink-dim">{t("player.preferredAudioLanguageHint")}</p>
        </div>
        <select value={audioLanguage} onChange={(e) => setAudioLanguage(e.target.value as PreferredAudioLanguage)} className="h-9 shrink-0 rounded-xl glass px-3 text-xs font-semibold text-ink outline-none focus:border-brand/40">
          {PREFERRED_AUDIO_LANGUAGES.map((l) => (
            <option key={l} value={l}>{l === "auto" ? `${t("player.audioLang.auto")} · ${t(`player.audioLang.${locale}`)}` : t(`player.audioLang.${l}`)}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
        <div>
          <p className="text-sm font-semibold text-ink">{t("player.autoSubtitles")}</p>
          <p className="text-xs text-ink-dim">{t("player.autoSubtitlesHint")}</p>
        </div>
        <Toggle on={autoSubtitles} onChange={() => setAutoSubtitles(!autoSubtitles)} />
      </div>
    </div>
  );
}

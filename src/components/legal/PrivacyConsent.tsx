"use client";

import useSWR from "swr";
import Link from "next/link";
import { useT } from "@/i18n/provider";
import { LICENSE_URL } from "@/lib/legal/content";

export interface PrivacyConsentInfo {
  /** Vrai uniquement sur le paquet UGREEN (MOVVIZ_REQUIRE_PRIVACY_CONSENT=1). */
  required: boolean;
  version: string;
  accepted: boolean;
}

/** Lit l'exigence de consentement (route publique). `undefined` tant que ça charge. */
export function usePrivacyConsentInfo(): PrivacyConsentInfo | undefined {
  const { data } = useSWR<PrivacyConsentInfo>(
    "/api/privacy/consent",
    (url: string) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { required: false, version: "", accepted: false })),
    { revalidateOnFocus: false }
  );
  return data;
}

/**
 * Case de consentement explicite : jamais pré-cochée, avec liens vers la politique
 * de confidentialité et la licence GPL. Même langage visuel que le reste de l'assistant.
 */
export function PrivacyConsentField({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  const t = useT();
  const label = t("legal.consentLabel");
  const privacy = (
    <Link key="privacy" href="/privacy" target="_blank" className="font-semibold text-brand-glow underline-offset-2 hover:underline">
      {t("legal.privacyLinkText")}
    </Link>
  );
  const license = (
    <a key="license" href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-glow underline-offset-2 hover:underline">
      {t("legal.licenseLinkText")}
    </a>
  );
  // Le libellé traduit contient {privacy} et {license} : on les remplace par les liens.
  const parts = label.split(/(\{privacy\}|\{license\})/g).map((part, i) =>
    part === "{privacy}" ? privacy : part === "{license}" ? license : <span key={i}>{part}</span>
  );

  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-3.5">
      <p className="text-xs font-bold text-ink">{t("legal.consentTitle")}</p>
      <label className="mt-2 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-ink-soft">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand,#8b5cf6)]"
        />
        <span>{parts}</span>
      </label>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">{t("legal.consentHint")}</p>
    </div>
  );
}

/** Liens permanents Confidentialité · Licence · Aide (écran de connexion, réglages). */
export function LegalLinks({ className }: { className?: string }) {
  const t = useT();
  return (
    <nav className={className ?? "flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-semibold text-ink-dim"}>
      <Link href="/privacy" target="_blank" className="hover:text-ink">{t("legal.footerPrivacy")}</Link>
      <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-ink">{t("legal.footerLicense")}</a>
      <Link href="/help" target="_blank" className="hover:text-ink">{t("legal.footerHelp")}</Link>
    </nav>
  );
}

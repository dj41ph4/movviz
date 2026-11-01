"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { AnimatedLogo } from "@/components/fx/AnimatedLogo";
import { HELP, PRIVACY, type LegalLocale, type LegalDocument } from "@/lib/legal/content";

const DOCS: Record<"privacy" | "help", Record<LegalLocale, LegalDocument>> = { privacy: PRIVACY, help: HELP };

/** Les URLs du texte deviennent des liens ; le reste est affiché tel quel. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-brand-glow underline-offset-2 hover:underline">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/**
 * Langue initiale : anglais (ce que voit un relecteur ou un robot), puis, côté navigateur,
 * la préférence enregistrée de l'interface, à défaut la langue du navigateur.
 */
function detectLegalLocale(): LegalLocale {
  try {
    const stored = window.localStorage.getItem("movviz.locale");
    if (stored) return stored.toLowerCase().startsWith("fr") ? "fr" : "en";
  } catch { /* stockage indisponible : on retombe sur le navigateur */ }
  return (navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

/**
 * Pages publiques /privacy et /help — lisibles sans compte (liens de l'App Center
 * UGREEN et de l'écran de connexion). Anglais et français, avec un sélecteur.
 */
export function LegalPage({ kind }: { kind: "privacy" | "help" }) {
  const t = useT();
  const [lang, setLang] = useState<LegalLocale>("en");
  useEffect(() => { setLang(detectLegalLocale()); }, []);
  const doc = DOCS[kind][lang];
  const other = kind === "privacy" ? { href: "/help", label: t("legal.footerHelp") } : { href: "/privacy", label: t("legal.footerPrivacy") };

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <div className="mb-8 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-3 text-ink-soft transition-colors hover:text-ink">
          <AnimatedLogo size="sm" />
          <span className="mv-brand-name text-logo-flow text-lg font-black tracking-tight">Movviz</span>
        </Link>
        <div className="flex items-center gap-4">
          <div role="group" aria-label="Language" className="flex overflow-hidden rounded-lg border border-white/10 text-[11px] font-bold">
            {(["en", "fr"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={cn("px-2.5 py-1 uppercase transition-colors", lang === code ? "bg-brand/20 text-brand-glow" : "text-ink-dim hover:text-ink")}
              >
                {code}
              </button>
            ))}
          </div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-dim hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("legal.back")}
          </Link>
        </div>
      </div>

      <article className="rounded-2xl glass p-6 sm:p-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{doc.title}</h1>
        <p className="mt-1 text-xs text-ink-dim">{doc.updated}</p>
        <p className="mt-5 text-sm leading-relaxed text-ink-soft">{doc.intro}</p>

        <div className="mt-8 space-y-7">
          {doc.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-base font-bold text-ink">{section.title}</h2>
              {section.paragraphs?.map((p) => (
                <p key={p} className="mt-2 text-sm leading-relaxed text-ink-soft">
                  <Linkified text={p} />
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft marker:text-brand-glow">
                  {section.bullets.map((b) => (
                    <li key={b}>
                      <Linkified text={b} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>

      <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-ink-dim">
        <Link href={other.href} className="hover:text-ink">{other.label}</Link>
        <a href="https://github.com/dj41ph4/movviz/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="hover:text-ink">{t("legal.footerLicense")}</a>
        <a href="https://github.com/dj41ph4/movviz/issues" target="_blank" rel="noopener noreferrer" className="hover:text-ink">{t("legal.footerSupport")}</a>
      </nav>
    </main>
  );
}

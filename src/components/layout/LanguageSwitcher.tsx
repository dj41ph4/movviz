"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { useI18n, useT } from "@/i18n/provider";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("common.languageLabel")}
        className="flex h-10 items-center gap-1.5 rounded-xl glass px-3 text-sm font-semibold transition-colors hover:border-brand/30"
      >
        <FlagIcon locale={locale} className="h-3.5 w-5 shrink-0 rounded-[2px]" />
        <span className="hidden uppercase sm:block">{locale}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-xl glass-strong p-1.5 shadow-2xl"
          >
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLocale(l);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  l === locale ? "bg-brand/15 text-ink" : "text-ink-soft hover:bg-white/5"
                )}
              >
                <FlagIcon locale={l} className="h-3.5 w-5 shrink-0 rounded-[2px]" />
                <span className="flex-1 text-left">{LOCALE_META[l].label}</span>
                {l === locale && <Check className="h-4 w-4 text-brand-glow" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sun, Moon, MonitorSmartphone } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useTheme } from "@/lib/theme/useTheme";
import type { ThemeMode } from "@/lib/theme/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { id: ThemeMode; icon: typeof Sun; labelKey: string }[] = [
  { id: "light", icon: Sun, labelKey: "profile.themeLight" },
  { id: "dark", icon: Moon, labelKey: "profile.themeDark" },
  { id: "auto", icon: MonitorSmartphone, labelKey: "profile.themeAuto" },
];

export function ThemeSwitcher() {
  const { mode, setThemeMode } = useTheme();
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

  const current = OPTIONS.find((o) => o.id === mode) ?? OPTIONS[2];
  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t(current.labelKey)}
        className="flex h-10 w-10 items-center justify-center rounded-xl glass text-ink-soft transition-colors hover:border-brand/30 hover:text-ink"
      >
        <CurrentIcon className="h-4 w-4" />
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
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setThemeMode(opt.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    opt.id === mode ? "bg-brand/15 text-ink" : "text-ink-soft hover:bg-white/5"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{t(opt.labelKey)}</span>
                  {opt.id === mode && <Check className="h-4 w-4 text-brand-glow" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

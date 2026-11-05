"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import type { SettingsSection } from "@/lib/settingsNav";

/**
 * Plusieurs panneaux d'un même sujet derrière des boutons (Moteur / Sources / Qualité…),
 * au lieu d'autant d'entrées dans le menu. En mode Essentiel, les sections réservées aux
 * experts sont masquées, sauf celle qu'un lien vient d'ouvrir.
 */
export function SettingsSections({
  sections,
  view,
  onView,
  expert,
  children,
}: {
  sections: SettingsSection[];
  view: string;
  onView: (id: string) => void;
  expert: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const visible = sections.filter((sec) => expert || !sec.expertOnly || sec.id === view);

  return (
    <div className="space-y-6">
      {visible.length > 1 && (
        <div role="tablist" className="flex flex-wrap gap-1 rounded-xl glass p-0.5">
          {visible.map((sec) => {
            const active = sec.id === view;
            return (
              <button
                key={sec.id}
                role="tab"
                aria-selected={active}
                onClick={() => onView(sec.id)}
                className={cn(
                  "min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ring-focus transition-colors",
                  active
                    ? sec.dangerous ? "bg-down/20 text-down shadow" : "brand-gradient text-white shadow"
                    : sec.dangerous ? "text-down/80 hover:text-down" : "text-ink-dim hover:text-ink",
                )}
              >
                {t(sec.labelKey)}
              </button>
            );
          })}
        </div>
      )}
      {children}
    </div>
  );
}

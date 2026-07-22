"use client";

import { useT } from "@/i18n/provider";
import { CONTINENTS } from "@/lib/metadata/continents";
import { Check } from "lucide-react";

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

/** Checkbox grid over the known continents — shared between the profile's own Discover card and the admin user detail page. */
export function ContinentPicker({ selected, onChange }: Props) {
  const t = useT();
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]);
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {CONTINENTS.map((c) => {
        const active = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${
              active ? "border-brand/40 bg-brand/10 text-ink" : "border-white/8 bg-black/20 text-ink-dim"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                active ? "brand-gradient" : "border border-white/15"
              }`}
            >
              {active && <Check className="h-3 w-3 text-white" />}
            </span>
            <span className="truncate">{t(`continents.${c.id}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

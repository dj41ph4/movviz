"use client";

import { useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { X, Plus } from "lucide-react";

/**
 * Free-text chip list for a title's alternate names. Visually a sibling of
 * TagEditor, deliberately NOT the same component: tags are a shared,
 * library-wide vocabulary with an /api/tags suggestion dropdown, while an
 * alias only ever makes sense for the one title it belongs to — suggesting
 * another title's alias here would be actively wrong.
 */
export function AliasEditor({
  aliases, onChange,
}: {
  aliases: string[];
  onChange: (aliases: string[]) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (value: string) => {
    const val = value.trim();
    if (!val || aliases.includes(val)) return;
    onChange([...aliases, val]);
    setDraft("");
    inputRef.current?.focus();
  };

  const remove = (alias: string) => onChange(aliases.filter((x) => x !== alias));

  return (
    <div>
      {aliases.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {aliases.map((alias) => (
            <span key={alias} className="flex items-center gap-1 rounded-full bg-brand/12 px-2.5 py-1 text-xs font-semibold text-brand-glow">
              {alias}
              <button onClick={() => remove(alias)} aria-label={t("common.remove")}><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }}
          placeholder={t("title.edit.aliasesPlaceholder")}
          className="h-9 min-w-0 flex-1 rounded-lg border border-white/8 bg-black/30 px-3 text-xs text-ink outline-none focus:border-brand/40"
        />
        <button
          onClick={() => add(draft)}
          aria-label={t("common.add")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg glass-strong text-ink-soft"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { X, Plus, Check } from "lucide-react";

export function TagEditor({
  tags, onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data } = useSWR<{ tags: string[] }>("/api/tags");
  const allTags = data?.tags ?? [];

  const suggestions = draft.trim()
    ? allTags.filter((tag) => tag.toLowerCase().includes(draft.toLowerCase()) && !tags.includes(tag)).slice(0, 6)
    : [];

  const add = (value: string) => {
    const val = value.trim();
    if (!val || tags.includes(val)) return;
    onChange([...tags, val]);
    setDraft("");
    inputRef.current?.focus();
  };

  const remove = (tag: string) => onChange(tags.filter((x) => x !== tag));

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-full bg-brand/12 px-2.5 py-1 text-xs font-semibold text-brand-glow">
            {tag}
            <button onClick={() => remove(tag)}><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <div className="relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={t("library.tagsPlaceholder")}
            className="h-9 flex-1 rounded-lg border border-white/8 bg-black/30 px-3 text-xs text-ink outline-none focus:border-brand/40"
          />
          <button onClick={() => add(draft)} className="flex h-9 w-9 items-center justify-center rounded-lg glass-strong text-ink-soft">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {focused && suggestions.length > 0 && (
          <div className="absolute left-0 right-14 top-full z-10 mt-1 overflow-hidden rounded-xl border border-white/10 bg-surface shadow-xl">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => add(s)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-ink-soft transition-colors hover:bg-white/5 hover:text-ink"
              >
                <Check className="h-3 w-3 text-ok" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

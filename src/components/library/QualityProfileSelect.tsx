"use client";

import { DEFAULT_QUALITY_PROFILES } from "@/lib/library/qualityProfiles";

/** First quality-profile picker in the app — everywhere else the 3 built-in
 *  profiles (any/hd-1080p/ultra-hd) are only ever set programmatically at
 *  add-time, never hand-picked afterward. */
export function QualityProfileSelect({
  value, onChange, disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-10 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none transition-colors focus:border-brand/40 disabled:opacity-50"
    >
      {DEFAULT_QUALITY_PROFILES.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

"use client";

import { useState } from "react";
import { mutate } from "swr";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import type { PublicUser } from "@/lib/auth/types";
import { DESKTOP_TEXT_SCALES, desktopTextScaleOrDefault, type DesktopTextScale } from "@/lib/accessibility/textScale";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type MeResponse = { user: PublicUser | null; setupRequired?: boolean };

export function AccessibilityPanel() {
  const t = useT();
  const user = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const scale = desktopTextScaleOrDefault(user?.desktopTextScale);

  async function save(next: DesktopTextScale) {
    if (!user || saving || next === scale) return;
    const userId = user.id;
    const updateCache = (value: DesktopTextScale) => mutate<MeResponse>("/api/auth/me", (current) =>
      current?.user?.id === userId ? { ...current, user: { ...current.user, desktopTextScale: value } } : current,
    { revalidate: false });
    setSaving(true);
    await updateCache(next);
    try {
      const res = await fetch("/api/profile/accessibility", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ desktopTextScale: next }),
      });
      if (!res.ok) throw new Error("save_failed");
    } catch {
      await updateCache(scale);
      toast("error", t("profile.accessibility.saveError"));
    } finally { setSaving(false); }
  }

  return (
    <section data-desktop-accessibility className="mb-6 hidden rounded-2xl glass p-5 lg:block" aria-labelledby="desktop-accessibility-heading" aria-busy={saving}>
      <h3 id="desktop-accessibility-heading" className="mb-1 text-sm font-bold text-ink-soft">{t("profile.accessibility.title")}</h3>
      <p className="mb-4 text-sm text-ink-dim">{t("profile.accessibility.hint")}</p>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-ink">{t("profile.accessibility.textSize")}</legend>
        <div className="flex flex-wrap gap-3">
          {DESKTOP_TEXT_SCALES.map((value) => (
            <label key={value} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm", value === scale ? "border-brand/50 bg-brand/10 text-ink" : "border-white/10 text-ink-soft", saving && "cursor-wait opacity-70")}>
              <input type="radio" name="desktop-text-scale" value={value} checked={scale === value} disabled={saving} onChange={() => void save(value)} className="accent-brand" />
              {t(value === 100 ? "profile.accessibility.standard" : value === 110 ? "profile.accessibility.large" : "profile.accessibility.larger")}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 rounded-xl border border-white/8 p-4">
        <p className="mb-1 text-xs font-semibold text-ink-dim">{t("profile.accessibility.preview")}</p>
        <p className="text-sm text-ink">{t("profile.accessibility.previewText")}</p>
      </div>
      <button type="button" onClick={() => void save(100)} disabled={saving || scale === 100} className="mt-3 min-h-11 rounded-xl px-3 py-2 text-sm text-ink-soft underline underline-offset-4 disabled:opacity-40">
        {t("profile.accessibility.reset")}
      </button>
    </section>
  );
}

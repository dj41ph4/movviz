"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/provider";
import { X, Loader2, FolderOpen, Save } from "lucide-react";
import { QualityProfileSelect } from "@/components/library/QualityProfileSelect";
import { RepairFileBrowserModal } from "@/components/settings/RepairFileBrowserModal";
import { AliasEditor } from "@/components/library/AliasEditor";
import { ArtworkFields } from "@/components/title/ArtworkFields";

/**
 * "Modifier la fiche" — fixes a mistake made when the title was first added
 * (wrong file linked, wrong quality profile, wrongly monitored), never
 * required for the automatic flow to keep working. Movie-only fields
 * (location) are simply omitted for series — a series has no single file of
 * its own, only per-episode ones already handled by "Récupérer téléchargements"
 * and the season/episode views.
 */
export function EditTitleModal({
  type, id, tmdbId, title, monitored, qualityProfileId, aliases, filePath,
  customBackdropPath, customLogoPath, isAdmin,
  onClose, onChange,
}: {
  type: "movie" | "series";
  id: string;
  tmdbId: number;
  title: string;
  monitored: boolean;
  qualityProfileId: string;
  aliases?: string[];
  filePath?: string | null;
  customBackdropPath?: string | null;
  customLogoPath?: string | null;
  /** Structural fields (monitored, quality profile, aliases, file location)
   *  stay admin-only, same as before — only the artwork picker below is open
   *  to every user (cosmetic edit, same permission as tags). */
  isAdmin: boolean;
  onClose: () => void;
  onChange: () => void;
}) {
  const t = useT();
  const [localMonitored, setLocalMonitored] = useState(monitored);
  const [localProfile, setLocalProfile] = useState(qualityProfileId);
  const [localAliases, setLocalAliases] = useState<string[]>(aliases ?? []);
  const [saving, setSaving] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [browseRoot, setBrowseRoot] = useState<string | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const libEndpoint = type === "movie" ? "/api/library/movies" : "/api/library/series";
  const aliasesDirty = JSON.stringify(localAliases) !== JSON.stringify(aliases ?? []);
  const dirty = localMonitored !== monitored || localProfile !== qualityProfileId || aliasesDirty;

  // filePath (movie.file.path) is the Plex-facing host path, e.g. NAS-mounted
  // "/volume1/docker/plex/films/..." — it doesn't exist inside this app's own
  // container, whose filesystem (what the browse API actually reads) mounts
  // the same media under its own root, e.g. "/data/films". Deriving the
  // browser's starting folder from filePath would open on a path the
  // container can't see. The movie engine instance's own completedPath is
  // always container-correct, so ask the engine instead of guessing.
  const openBrowser = async () => {
    if (!browseRoot) {
      try {
        const res = await fetch("/api/engine/instances");
        const data = await res.json() as { instances?: { category: string; completedPath?: string }[] };
        const movieInst = data.instances?.find((i) => i.category === "movie");
        setBrowseRoot(movieInst?.completedPath || "/");
      } catch {
        setBrowseRoot("/");
      }
    }
    setBrowsing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${libEndpoint}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ monitored: localMonitored, qualityProfileId: localProfile, aliases: localAliases }),
      });
      onChange();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const chooseFile = async (path: string) => {
    setBrowsing(false);
    setLocationBusy(true);
    setLocationError(null);
    try {
      const res = await fetch(`/api/library/movies/${id}/location`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLocationError(data.error ?? "error");
        return;
      }
      onChange();
    } finally {
      setLocationBusy(false);
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
        <div
          className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-void shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
            <h2 className="text-lg font-bold text-ink">{t("title.edit.title")} — {title}</h2>
            <button onClick={onClose} aria-label={t("common.close")} className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl glass-strong text-ink-dim hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 p-6">
            {isAdmin && (
              <>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3">
                  <span className="text-sm font-semibold text-ink">{t("title.edit.monitored")}</span>
                  <input
                    type="checkbox"
                    checked={localMonitored}
                    onChange={(e) => setLocalMonitored(e.target.checked)}
                    className="h-5 w-5 accent-brand"
                  />
                </label>

                <div>
                  <p className="mb-1.5 text-sm font-semibold text-ink">{t("title.edit.qualityProfile")}</p>
                  <QualityProfileSelect value={localProfile} onChange={setLocalProfile} />
                </div>

                <div>
                  <p className="mb-1 text-sm font-semibold text-ink">{t("title.edit.aliases")}</p>
                  <p className="mb-2 text-xs leading-relaxed text-ink-dim">{t("title.edit.aliasesHint")}</p>
                  <AliasEditor aliases={localAliases} onChange={setLocalAliases} />
                </div>

                {type === "movie" && (
                  <div>
                    <p className="mb-1.5 text-sm font-semibold text-ink">{t("title.edit.location")}</p>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-xl border border-white/8 bg-black/30 px-3 py-2.5 text-xs text-ink-soft">
                        {filePath || t("title.edit.noFile")}
                      </code>
                      <button
                        onClick={openBrowser}
                        disabled={locationBusy}
                        className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl glass px-3 text-xs font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
                      >
                        {locationBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                        {t("title.edit.browse")}
                      </button>
                    </div>
                    {locationError && <p className="mt-1.5 text-xs text-down">{t("title.edit.locationError")}</p>}
                  </div>
                )}

                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("title.edit.save")}
                </button>

                <div className="border-t border-white/8 pt-5" />
              </>
            )}

            <div>
              <p className="mb-3 text-sm font-semibold text-ink">{t("title.artwork.sectionTitle")}</p>
              <ArtworkFields
                type={type}
                id={id}
                tmdbId={tmdbId}
                currentBackdropPath={customBackdropPath}
                currentLogoPath={customLogoPath}
                onChange={onChange}
              />
            </div>
          </div>
        </div>
      </div>

      {browsing && (
        <RepairFileBrowserModal
          initial={browseRoot ?? "/"}
          onCancel={() => setBrowsing(false)}
          onChoose={chooseFile}
        />
      )}
    </>,
    document.body
  );
}

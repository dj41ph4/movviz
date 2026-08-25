"use client";

import { useState, useMemo, useRef, useEffect, memo } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { daysUntil } from "@/lib/library/releaseSchedule";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import type { LibraryMovie, LibraryStatus } from "@/lib/library/types";
import { encodeLibraryRef } from "@/lib/library/types";
import type { EngineTorrent } from "@/lib/types";
import { ManualSearchModal } from "@/components/search/ManualSearchModal";
import { DashboardPosterCard } from "@/components/dashboard/DashboardPosterCard";
import { Trash2, RotateCw, Loader2, Check, Search, Clock, HardDriveDownload, Eye, EyeOff, Calendar, ListFilter, Sparkles, X, Layers, MoreVertical } from "lucide-react";

const STATUS_TONE: Record<LibraryStatus, string> = {
  available: "text-ok bg-ok/12 border-ok/25",
  downloading: "text-cyan bg-cyan/12 border-cyan/25",
  searching: "text-brand-glow bg-brand/12 border-brand/25",
  missing: "text-amber bg-amber/12 border-amber/25",
  upcoming: "text-ink-dim bg-white/6 border-white/10",
};
const STATUS_ICON: Record<LibraryStatus, React.ElementType> = {
  available: Check,
  downloading: HardDriveDownload,
  searching: Search,
  missing: Clock,
  upcoming: Calendar,
};

/** Same click-outside/Escape idiom as UserMenu.tsx and Découverte's genre
 *  menu — the dropdown itself is portalled to document.body (position fixed,
 *  computed from the button's own rect) because this button lives inside
 *  DashboardPosterCard's popover, which clips overflow to its own rounded
 *  panel; an absolutely-positioned dropdown got silently cut off there. */
function CardMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ left: Math.min(rect.right - 224, window.innerWidth - 232), top: rect.bottom + 8 });
    }
    setOpen((v) => !v);
  };
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        title={label}
        aria-label={label}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 text-white transition-colors hover:border-white hover:bg-white/10"
      >
        <MoreVertical className="h-[18px] w-[18px]" />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[90] w-56 overflow-hidden rounded-xl border border-white/10 bg-[#171522]/98 p-1.5 shadow-2xl backdrop-blur-xl"
          style={{ left: pos.left, top: pos.top }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
}

function MenuItem({ icon: Icon, label, onClick, tone, disabled, busy }: { icon: React.ElementType; label: string; onClick: () => void; tone?: "danger"; disabled?: boolean; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors disabled:opacity-50",
        tone === "danger" ? "text-down hover:bg-down/10" : "text-ink-soft hover:bg-white/5 hover:text-ink"
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

export const LibraryMovieCard = memo(function LibraryMovieCard({
  movie, torrent, watched, onChange, index = 0, backdropPath, logoPath, titleEmbedded,
}: {
  movie: LibraryMovie & { plexUrl?: string | null };
  torrent?: EngineTorrent | null;
  watched?: boolean;
  onChange: () => void;
  index?: number;
  /** Resolved by the grid's single batch call (see useTitleArtworkBatch) — never fetched per-card. */
  backdropPath?: string | null;
  logoPath?: string | null;
  titleEmbedded?: boolean;
}) {
  const { t } = useI18n();
  const reduceMotion = useShouldReduceMotion();
  const user = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingWatched, setTogglingWatched] = useState(false);

  const toggleWatched = async () => {
    if (togglingWatched) return;
    setTogglingWatched(true);
    try {
      await fetch("/api/watch/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tmdbId: movie.tmdbId, type: "movie", watched: !watched, title: movie.title }),
      });
      onChange();
    } finally {
      setTogglingWatched(false);
    }
  };

  const search = async () => {
    setBusy(true);
    try {
      await fetch(`/api/library/movies/${movie.id}/search`, { method: "POST" });
      onChange();
    } finally {
      setBusy(false);
    }
  };
  const handleOptimize = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/library/movies/${movie.id}/optimize`, { method: "POST" });
      if ((await res.json()).ok) onChange();
    } finally { setBusy(false); }
  };

  const remove = async (withFiles: boolean) => {
    setDeleting(true);
    await fetch(`/api/library/movies/${movie.id}?deleteFiles=${withFiles}`, { method: "DELETE" });
    await new Promise((r) => setTimeout(r, 300));
    onChange();
  };

  const canGrab = movie.status !== "downloading" && movie.status !== "searching";

  const isUpcoming = useMemo(
    () => !!(movie.vfReleaseDate && new Date(movie.vfReleaseDate) > new Date()),
    [movie.vfReleaseDate]
  );
  const daysToRelease = useMemo(() => daysUntil(movie.vfReleaseDate ?? movie.releaseDate), [movie.vfReleaseDate, movie.releaseDate]);
  const isDownloading = movie.status === "downloading" || movie.status === "searching";
  const upcomingLabel = daysToRelease != null
    ? daysToRelease <= 1
      ? t("dashboard.hero.inOneDay")
      : t("dashboard.hero.inDays", { n: daysToRelease })
    : t("status.wanted");
  const StatusIcon = STATUS_ICON[movie.status];

  const cascadeStyle = reduceMotion ? undefined : ({ "--cascade-delay": `${Math.min(index * 0.05, 0.5)}s` } as React.CSSProperties);

  const statusPill = (
    <span className={cn(
      "flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold",
      movie.status === "upcoming" && daysToRelease != null ? "border-brand/25 bg-brand/12 text-brand-glow" : STATUS_TONE[movie.status]
    )}>
      <StatusIcon className={cn("h-2.5 w-2.5", isDownloading && "animate-spin")} />
      {movie.status === "upcoming" && daysToRelease != null ? upcomingLabel : t(`status.${movie.status}`)}
    </span>
  );

  const downloadProgress = torrent && movie.status === "downloading" ? Math.round((torrent.progress ?? 0) * 100) : undefined;

  return (
    <article className={cn("w-full", !reduceMotion && "animate-cascade-in")} style={cascadeStyle}>
      <DashboardPosterCard
        layout="fill"
        tmdbId={movie.tmdbId}
        type="movie"
        title={movie.title}
        posterPath={movie.posterPath}
        backdropPath={backdropPath ?? movie.backdropPath}
        logoPath={logoPath}
        titleEmbedded={titleEmbedded}
        rating={movie.rating}
        year={movie.year}
        runtime={movie.runtime}
        genres={movie.genres}
        badge={statusPill}
        inLibrary
        progressPercent={downloadProgress}
        playback={movie.status === "available" && movie.plexUrl ? {
          ratingKey: movie.plexRatingKey ?? "",
          plexUrl: movie.plexUrl,
          type: "movie",
        } : undefined}
        popoverActions={
          <CardMenu label={t("common.more")}>
            <MenuItem
              icon={watched ? EyeOff : Eye}
              label={watched ? t("watch.markUnwatched") : t("watch.markWatched")}
              onClick={toggleWatched}
              busy={togglingWatched}
            />
            {movie.status === "available" && movie.file && (
              <MenuItem icon={Sparkles} label={t("library.optimize")} onClick={handleOptimize} busy={busy} />
            )}
            {canGrab && (
              <MenuItem icon={RotateCw} label={t("library.autoSearch")} onClick={search} busy={busy} />
            )}
            {canGrab && (
              <MenuItem icon={ListFilter} label={t("library.manualSearch")} onClick={() => setShowManualSearch(true)} />
            )}
            {user?.role === "admin" && !confirmDelete && (
              <MenuItem icon={Trash2} label={t("common.remove")} onClick={() => setConfirmDelete(true)} tone="danger" disabled={deleting} busy={deleting} />
            )}
            {user?.role === "admin" && confirmDelete && (
              <div className="space-y-1 px-1 py-1">
                <p className="px-2 py-1 text-[11px] font-semibold text-ink-dim">{t("common.confirm")} ?</p>
                <MenuItem icon={Trash2} label={t("downloads.removeData")} onClick={() => { remove(true); setConfirmDelete(false); }} tone="danger" />
                <MenuItem icon={Trash2} label={t("common.remove")} onClick={() => { remove(false); setConfirmDelete(false); }} tone="danger" />
                <MenuItem icon={X} label={t("common.cancel")} onClick={() => setConfirmDelete(false)} />
              </div>
            )}
          </CardMenu>
        }
        popoverFooter={
          movie.versions && movie.versions.length > 1 ? (
            <span className="flex w-fit items-center gap-1 rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold text-white/80">
              <Layers className="h-3 w-3" /> {t("library.versionsCount", { n: movie.versions.length })}
            </span>
          ) : undefined
        }
      />
      {canGrab && (
        <ManualSearchModal
          open={showManualSearch}
          onClose={() => setShowManualSearch(false)}
          libraryRef={encodeLibraryRef({ kind: "movie", movieId: movie.id })}
          query={`${movie.title} ${movie.year ?? ""}`.trim()}
          category="movie"
          refTitle={movie.title}
          year={movie.year ? String(movie.year) : undefined}
          title={movie.title}
        />
      )}
    </article>
  );
});

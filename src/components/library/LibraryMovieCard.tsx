"use client";

import { useState, useMemo, memo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/provider";
import { cn, formatDate, openPlexLink } from "@/lib/utils";
import { daysUntil } from "@/lib/library/releaseSchedule";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import type { LibraryMovie, LibraryStatus } from "@/lib/library/types";
import { encodeLibraryRef } from "@/lib/library/types";
import type { EngineTorrent } from "@/lib/types";
import { TagEditor } from "./TagEditor";
import { MediaBadges, buildMediaBadgeItems, BADGE_SHAPE } from "./MediaBadges";
import { ReportIssueButton } from "@/components/issues/ReportIssueButton";
import { ManualSearchModal } from "@/components/search/ManualSearchModal";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { usePlayLabel } from "@/lib/player/usePlayLabel";
import { Star, Trash2, RotateCw, Loader2, Film, Check, Search, Clock, HardDriveDownload, Tag, Eye, Play, Calendar, ListFilter, Sparkles, CalendarCheck, X, Layers } from "lucide-react";

const STATUS_TONE: Record<LibraryStatus, string> = {
  available: "text-ok bg-ok/12 border-ok/25",
  downloading: "text-cyan bg-cyan/12 border-cyan/25",
  searching: "text-brand-glow bg-brand/12 border-brand/25",
  missing: "text-amber bg-amber/12 border-amber/25",
  upcoming: "text-ink-dim bg-white/6 border-white/10",
};
const STATUS_BG: Record<LibraryStatus, string> = {
  available: "bg-ok/90 text-white",
  downloading: "bg-cyan/90 text-white",
  searching: "bg-brand/90 text-white",
  missing: "bg-amber/90 text-white",
  upcoming: "bg-white/20 text-white",
};
const STATUS_ICON: Record<LibraryStatus, React.ElementType> = {
  available: Check,
  downloading: HardDriveDownload,
  searching: Search,
  missing: Clock,
  upcoming: Calendar,
};

export const LibraryMovieCard = memo(function LibraryMovieCard({
  movie, torrent, watched, onChange, index = 0,
}: {
  movie: LibraryMovie & { plexUrl?: string | null };
  torrent?: EngineTorrent | null;
  watched?: boolean;
  onChange: () => void;
  index?: number;
}) {
  const { t, locale } = useI18n();
  const { enabled: betaPlayer } = useBetaPlayer();
  const reduceMotion = useShouldReduceMotion();
  const user = useCurrentUser();
  const { play } = usePlayer();
  const { label: playLabel } = usePlayLabel(movie.plexRatingKey);
  const [busy, setBusy] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const poster = useMemo(
    () => movie.posterPath ? `/tmdb/w500${movie.posterPath}` : null,
    [movie.posterPath]
  );
  const Icon = STATUS_ICON[movie.status];

  const setTags = async (tags: string[]) => {
    await fetch(`/api/library/movies/${movie.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    onChange();
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
  // Same day-count treatment as the dashboard's "Bientôt disponible" row —
  // "à venir" alone doesn't tell you if that's tomorrow or in six months.
  const daysToRelease = useMemo(() => daysUntil(movie.vfReleaseDate ?? movie.releaseDate), [movie.vfReleaseDate, movie.releaseDate]);
  const isDownloading = movie.status === "downloading" || movie.status === "searching";
  const upcomingLabel = daysToRelease != null
    ? daysToRelease <= 1
      ? t("dashboard.hero.inOneDay")
      : t("dashboard.hero.inDays", { n: daysToRelease })
    : t("status.wanted");
  const statusBadge = useMemo(() =>
    movie.status === "available"
      ? { icon: Check, cls: "bg-ok/90 text-white", label: t("status.available") }
      : isDownloading
        ? { icon: Loader2, cls: "bg-purple-500/90 text-white", label: t("status.downloading") }
        : movie.status === "upcoming" || (movie.status === "missing" && isUpcoming)
          ? { icon: CalendarCheck, cls: "bg-black/55 text-brand-glow", label: upcomingLabel }
          : movie.status === "missing"
            ? { icon: Clock, cls: "bg-amber/80 text-white", label: t("status.missing") }
            : null,
    [movie.status, isUpcoming, isDownloading, upcomingLabel, t]
  );

  const cascadeAnim = reduceMotion ? {} : {
    layout: true as const,
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.25, ease: "easeInOut" as const } },
    transition: { duration: 0.3, delay: Math.min(index * 0.05, 0.5) },
    whileHover: { scale: 1.03, y: -2 },
    whileTap: { scale: 0.98 },
  };
  const btnSpring = reduceMotion ? {} : {
    whileTap: { scale: 0.95 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  };

  return (
    <motion.article className="group w-full transition-shadow duration-300 hover:shadow-[0_0_25px_rgba(168,130,255,0.15)]" {...cascadeAnim}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-surface">
        <Link href={`/title/movie/${movie.tmdbId}`} className="absolute inset-0 block">
          {poster ? (
            <motion.img
              src={poster}
              alt={movie.title}
              loading="lazy"
              className="h-full w-full object-cover"
              initial={reduceMotion ? undefined : { opacity: 0 }}
              animate={reduceMotion ? undefined : { opacity: imgLoaded ? 1 : 0 }}
              transition={{ duration: 0.4 }}
              onLoad={() => setImgLoaded(true)}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-2 via-surface to-abyss p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12">
                <Film className="h-6 w-6 text-brand-glow" />
              </div>
              <div className="flex items-center justify-center gap-1 flex-wrap">
                <span className="text-sm font-semibold text-ink/80">{movie.title}</span>
                {movie.year && (
                  <span className={cn(BADGE_SHAPE, "border border-white/15 bg-black/55 text-white")}>{movie.year}</span>
                )}
                {movie.file?.hdr && buildMediaBadgeItems(
                  { resolution: null, videoCodec: null, audioCodec: null, hdr: movie.file.hdr, source: null, language: null },
                  "overlay"
                )}
              </div>
            </div>
          )}
        </Link>

        {torrent && movie.status === "downloading" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
            <div className="h-full brand-gradient" style={{ width: `${Math.round((torrent.progress ?? 0) * 100)}%` }} />
          </div>
        )}

        <div className={cn(BADGE_SHAPE, "pointer-events-none absolute left-2 top-2 border-white/15 bg-black/55 text-amber")}>
          <Star className="h-3 w-3 fill-amber" /> {movie.rating.toFixed(1)}
        </div>
        {movie.versions && movie.versions.length > 1 && (
          <div className={cn(BADGE_SHAPE, "pointer-events-none absolute left-2 top-9 border-white/15 bg-black/55 text-white")}>
            <Layers className="h-3 w-3" /> {movie.versions.length}
          </div>
        )}
        {statusBadge && (
          <div className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/70 backdrop-blur-sm pointer-events-none absolute right-2 top-2", statusBadge.cls)} title={statusBadge.label}>
            <statusBadge.icon className={cn("h-3.5 w-3.5", isDownloading && "animate-spin")} />
          </div>
        )}
        {watched && !statusBadge && (
          <div title={t("watch.watched")} className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-white/15 bg-ok/90 text-white backdrop-blur-sm pointer-events-none absolute right-2 top-2">
            <Eye className="h-3.5 w-3.5" />
          </div>
        )}

        <MediaBadges file={movie.file} plexMediaInfo={movie.plexMediaInfo} year={movie.year} className="absolute bottom-2 left-2 right-2" compactOnMobile hideTypes={["resolution", "year", "hdr"]} />
        {movie.file?.resolution && (
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 flex items-center gap-1">
            {buildMediaBadgeItems(
              { resolution: movie.file.resolution, videoCodec: null, audioCodec: null, hdr: null, source: null, language: null },
              "overlay"
            )}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 hidden lg:flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/10 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {movie.status === "available" && movie.plexUrl && (
            betaPlayer && movie.plexRatingKey ? (
              <motion.button
                {...btnSpring}
                onClick={(e) => play({
                  ratingKey: movie.plexRatingKey!,
                  plexUrl: movie.plexUrl!,
                  title: movie.title,
                  useTranscode: betaPlayer,
                  originRect: e.currentTarget.getBoundingClientRect(),
                  posterUrl: poster,
                })}
                className="pointer-events-auto mb-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-amber text-xs font-bold text-black"
              >
                <Play className="h-3.5 w-3.5 fill-black" /> {playLabel}
              </motion.button>
            ) : (
              <a
                href={movie.plexUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => openPlexLink(e, movie.plexUrl!)}
                className="pointer-events-auto mb-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-amber text-xs font-bold text-black"
              >
                <Play className="h-3.5 w-3.5 fill-black" /> {t("library.watchOnPlex")}
              </a>
            )
          )}
          <div className="pointer-events-auto flex gap-2">
            {movie.status === "available" && movie.file && (
              <motion.button {...btnSpring} onClick={handleOptimize} disabled={busy} title="Optimiser (rechercher une meilleure version et remplacer)" className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl glass-strong text-xs font-bold text-brand-glow hover:text-ink">
                <Sparkles className="h-3.5 w-3.5" />
              </motion.button>
            )}
            {canGrab && (
              <motion.button {...btnSpring} onClick={search} disabled={busy} title={t("library.autoSearch")} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl brand-gradient text-xs font-bold text-white">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              </motion.button>
            )}
            {canGrab && (
              <motion.button {...btnSpring} onClick={() => setShowManualSearch(true)} title={t("library.manualSearch")} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl glass-strong text-xs font-bold text-ink-soft hover:text-ink">
                <ListFilter className="h-3.5 w-3.5" />
              </motion.button>
            )}
            <motion.button {...btnSpring} onClick={() => setEditingTags((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-xl glass-strong text-ink-soft">
              <Tag className="h-3.5 w-3.5" />
            </motion.button>
            {movie.status === "available" && (
              <ReportIssueButton libraryType="movie" libraryId={movie.id} />
            )}
            {!confirmDelete ? (
              <motion.button {...btnSpring} onClick={() => setConfirmDelete(true)} disabled={deleting} className="flex h-9 w-9 items-center justify-center rounded-xl glass-strong text-down disabled:opacity-50">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </motion.button>
            ) : (
              <div className="flex gap-1">
                <motion.button {...btnSpring} onClick={() => { remove(true); setConfirmDelete(false); }} className="flex h-9 items-center gap-1 rounded-xl bg-down px-2.5 text-[10px] font-bold text-white">
                  {t("downloads.removeData")}
                </motion.button>
                <motion.button {...btnSpring} onClick={() => { remove(false); setConfirmDelete(false); }} className="flex h-9 items-center gap-1 rounded-xl glass-strong px-2 text-[10px] font-bold text-ink-soft">
                  {t("common.remove")}
                </motion.button>
                <motion.button {...btnSpring} onClick={() => setConfirmDelete(false)} className="flex h-9 w-9 items-center justify-center rounded-xl glass-strong text-ink-dim">
                  <X className="h-3 w-3" />
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions mobiles — un seul geste utile à la fois, pas une rangée
          d'icônes de gestion (tags, suppression, recherche manuelle...) qui
          n'ont leur place que dans la fiche détaillée. Le mobile sert à
          vérifier ce qui existe et à lancer une recherche/lecture en un tap,
          rien de plus — cachée sur desktop, qui garde sa rangée complète au
          survol. */}
      <div className="lg:hidden">
        {movie.status === "available" && movie.plexUrl ? (
          <div className="mt-1.5">
            {betaPlayer && movie.plexRatingKey ? (
              <motion.button {...btnSpring} onClick={(e) => play({
                ratingKey: movie.plexRatingKey!,
                plexUrl: movie.plexUrl!,
                title: movie.title,
                useTranscode: betaPlayer,
                originRect: e.currentTarget.getBoundingClientRect(),
                posterUrl: poster,
              })} className="flex w-full h-10 items-center justify-center gap-1.5 rounded-xl bg-amber text-xs font-bold text-black active:bg-amber/80">
                <Play className="h-3.5 w-3.5 fill-black" /> {playLabel}
              </motion.button>
            ) : (
              <a href={movie.plexUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => openPlexLink(e, movie.plexUrl!)} className="flex w-full h-10 items-center justify-center gap-1.5 rounded-xl bg-amber text-xs font-bold text-black active:bg-amber/80">
                <Play className="h-3.5 w-3.5 fill-black" /> {t("library.watchOnPlex")}
              </a>
            )}
          </div>
        ) : canGrab ? (
          <div className="mt-1.5">
            <motion.button {...btnSpring} onClick={search} disabled={busy} className="flex w-full h-10 items-center justify-center gap-1.5 rounded-xl glass-strong text-xs font-bold text-ink-soft active:bg-white/10">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              {t("library.autoSearch")}
            </motion.button>
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 px-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={`/title/movie/${movie.tmdbId}`} className="truncate text-sm font-semibold text-ink transition-all duration-200 hover:text-brand-glow hover:scale-[1.02] hover:origin-left">{movie.title}</Link>
          {movie.year && (
            <span className={cn(BADGE_SHAPE, "border border-white/8 bg-black/20 text-ink-soft")}>{movie.year}</span>
          )}
          {movie.file?.hdr && buildMediaBadgeItems(
            { resolution: null, videoCodec: null, audioCodec: null, hdr: movie.file.hdr, source: null, language: null },
            "surface"
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            movie.status === "upcoming" && daysToRelease != null ? "border-brand/25 bg-brand/12 text-brand-glow" : STATUS_TONE[movie.status]
          )}>
            <Icon className="h-2.5 w-2.5" />
            {movie.status === "upcoming" && daysToRelease != null ? upcomingLabel : t(`status.${movie.status}`)}
          </span>
          {movie.status === "downloading" && torrent && (
            <span className="text-[10px] text-ink-dim">{Math.round((torrent.progress ?? 0) * 100)}%</span>
          )}
          {formatDate(movie.releaseDate, locale) && (
            <span className="flex items-center gap-1 text-[10px] text-ink-dim">
              <Calendar className="h-2.5 w-2.5" /> {formatDate(movie.releaseDate, locale)}
            </span>
          )}
        </div>
        {movie.tags && movie.tags.length > 0 && !editingTags && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {movie.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-brand/12 px-1.5 py-0.5 text-[9px] font-semibold text-brand-glow">{tag}</span>
            ))}
          </div>
        )}
        {editingTags && (
          <div className="mt-2">
            <TagEditor tags={movie.tags ?? []} onChange={setTags} />
          </div>
        )}
      </div>
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
    </motion.article>
  );
});






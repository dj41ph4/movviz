"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { cn, formatDate } from "@/lib/utils";
import type { LibraryMovie, LibraryStatus } from "@/lib/library/types";
import { encodeLibraryRef } from "@/lib/library/types";
import type { EngineTorrent } from "@/lib/types";
import { TagEditor } from "./TagEditor";
import { MediaBadges } from "./MediaBadges";
import { ReportIssueButton } from "@/components/issues/ReportIssueButton";
import { ManualSearchModal } from "@/components/search/ManualSearchModal";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";
import { Star, Trash2, RotateCw, Loader2, Film, Check, Search, Clock, HardDriveDownload, Tag, Eye, Play, Calendar, ListFilter, CalendarCheck, X } from "lucide-react";

const STATUS_TONE: Record<LibraryStatus, string> = {
  available: "text-ok bg-ok/12 border-ok/25",
  downloading: "text-cyan bg-cyan/12 border-cyan/25",
  searching: "text-brand-glow bg-brand/12 border-brand/25",
  missing: "text-amber bg-amber/12 border-amber/25",
};
const STATUS_ICON: Record<LibraryStatus, React.ElementType> = {
  available: Check,
  downloading: HardDriveDownload,
  searching: Search,
  missing: Clock,
};

export function LibraryMovieCard({
  movie, torrent, watched, onChange,
}: {
  movie: LibraryMovie & { plexUrl?: string | null };
  torrent?: EngineTorrent | null;
  watched?: boolean;
  onChange: () => void;
}) {
  const { t, locale } = useI18n();
  const { enabled: betaPlayer } = useBetaPlayer();
  const [playRatingKey, setPlayRatingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const poster = movie.posterPath ? `https://image.tmdb.org/t/p/w500${movie.posterPath}` : null;
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
  const remove = async (withFiles: boolean) => {
    await fetch(`/api/library/movies/${movie.id}?deleteFiles=${withFiles}`, { method: "DELETE" });
    onChange();
  };

  const canGrab = movie.status !== "downloading" && movie.status !== "searching";

  const isUpcoming = movie.vfReleaseDate && new Date(movie.vfReleaseDate) > new Date();
  const isDownloading = movie.status === "downloading" || movie.status === "searching";
  const statusBadge = movie.status === "available"
    ? { icon: Check, cls: "bg-ok/90 text-white", label: t("status.available") }
    : isDownloading
      ? { icon: Loader2, cls: "bg-purple-500/90 text-white", label: t("status.downloading") }
      : movie.status === "missing" && isUpcoming
        ? { icon: CalendarCheck, cls: "bg-cyan/80 text-white", label: t("status.wanted") }
        : movie.status === "missing"
          ? { icon: Clock, cls: "bg-amber/80 text-white", label: t("status.missing") }
          : null;

  return (
    <article className="group w-full">
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-surface">
        <Link href={`/title/movie/${movie.tmdbId}`} className="absolute inset-0 block">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt={movie.title} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
              <Film className="h-7 w-7 text-ink-soft/70" />
              <span className="line-clamp-3 text-sm font-semibold text-ink/90">{movie.title}</span>
            </div>
          )}
        </Link>

        {torrent && movie.status === "downloading" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
            <div className="h-full brand-gradient" style={{ width: `${Math.round((torrent.progress ?? 0) * 100)}%` }} />
          </div>
        )}

        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold backdrop-blur">
          <Star className="h-3 w-3 fill-amber text-amber" /> {movie.rating.toFixed(1)}
        </div>
        {statusBadge && (
          <div className={cn("pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold backdrop-blur", statusBadge.cls)} title={statusBadge.label}>
            <statusBadge.icon className={cn("h-3 w-3", isDownloading && "animate-spin")} />
            {watched && movie.status === "available" && <Eye className="h-2.5 w-2.5 ml-0.5" />}
          </div>
        )}
        {watched && !statusBadge && (
          <div title={t("watch.watched")} className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-ok/80 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
            <Eye className="h-3 w-3" />
          </div>
        )}

        <MediaBadges file={movie.file} className="absolute bottom-2 left-2 right-2" />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/10 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {movie.status === "available" && movie.plexUrl && (
            betaPlayer && movie.plexRatingKey ? (
              <button
                onClick={() => setPlayRatingKey(movie.plexRatingKey!)}
                className="pointer-events-auto mb-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-amber text-xs font-bold text-black"
              >
                <Play className="h-3.5 w-3.5 fill-black" /> {t("library.watchOnPlex")}
              </button>
            ) : (
              <a
                href={movie.plexUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto mb-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-amber text-xs font-bold text-black"
              >
                <Play className="h-3.5 w-3.5 fill-black" /> {t("library.watchOnPlex")}
              </a>
            )
          )}
          <div className="pointer-events-auto flex gap-2">
            {canGrab && (
              <button onClick={search} disabled={busy} title={t("library.autoSearch")} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl brand-gradient text-xs font-bold text-white">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              </button>
            )}
            {canGrab && (
              <button onClick={() => setShowManualSearch(true)} title={t("library.manualSearch")} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl glass-strong text-xs font-bold text-ink-soft hover:text-ink">
                <ListFilter className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={() => setEditingTags((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-xl glass-strong text-ink-soft">
              <Tag className="h-3.5 w-3.5" />
            </button>
            {movie.status === "available" && (
              <ReportIssueButton libraryType="movie" libraryId={movie.id} />
            )}
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="flex h-9 w-9 items-center justify-center rounded-xl glass-strong text-down">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={() => { remove(true); setConfirmDelete(false); }} className="flex h-9 items-center gap-1 rounded-xl bg-down px-2.5 text-[10px] font-bold text-white">
                  {t("downloads.removeData")}
                </button>
                <button onClick={() => { remove(false); setConfirmDelete(false); }} className="flex h-9 items-center gap-1 rounded-xl glass-strong px-2 text-[10px] font-bold text-ink-soft">
                  {t("common.remove")}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="flex h-9 w-9 items-center justify-center rounded-xl glass-strong text-ink-dim">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <Link href={`/title/movie/${movie.tmdbId}`} className="block truncate text-sm font-semibold text-ink hover:text-brand-glow">{movie.title}</Link>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", STATUS_TONE[movie.status])}>
            <Icon className="h-2.5 w-2.5" />
            {t(`status.${movie.status}`)}
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
      {playRatingKey && movie.plexUrl && movie.plexRatingKey && (
        <VideoPlayer
          ratingKey={playRatingKey}
          plexUrl={movie.plexUrl}
          title={movie.title}
          onClose={() => setPlayRatingKey(null)}
          useTranscode={betaPlayer}
        />
      )}
    </article>
  );
}

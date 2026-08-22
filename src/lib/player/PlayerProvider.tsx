"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { PREBUFFER_SECONDS } from "@/components/player/VideoPlayer";
import { TheaterModePlayer } from "@/components/player/TheaterModePlayer";
import { stopAllAmbientVideo } from "./ambientVideoRegistry";

export interface OriginRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PlayNowRequest {
  ratingKey: string;
  /** Stable Movviz media identity. When present, playback resolves the local file first. */
  movvizId?: string;
  /** Series identity is kept separate from its episode source id so the
   * player can resolve exactly the immediate next episode. */
  seriesId?: string;
  plexUrl: string;
  title: string;
  useTranscode: boolean;
  /** TMDb identity of the watched item — lets Movviz record "quoi + quand"
   *  for direct playback (feeds the AI's recent-watches memory). */
  tmdbId?: number;
  type?: "movie" | "series";
  seasonNumber?: number;
  episodeNumber?: number;
  /** Clicked element's getBoundingClientRect() — feeds Theater Mode's expand-from-origin animation (Phase B). Undefined for a programmatic play with no click origin. */
  originRect?: OriginRect;
  backdropUrl?: string | null;
  posterUrl?: string | null;
  /** Explicit Netflix-style restart action: skip the resume prompt once. */
  startFromBeginning?: boolean;
}

interface PlayerContextValue {
  request: PlayNowRequest | null;
  play: (req: PlayNowRequest) => void;
  close: () => void;
}

const PlayerCtx = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error("usePlayer() must be used within PlayerProvider");
  return ctx;
}

/**
 * Single mount point for the video player, replacing three previously
 * duplicated local-state + inline-mount implementations (TitleContent,
 * LibraryMovieCard, the episode page) plus a fourth call site
 * (DashboardHero) that never had one at all. Mounted once in AppShell —
 * because play()/close() live above the page tree, closing the player
 * never unmounts the page underneath it, so scroll position and component
 * state are preserved automatically.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<PlayNowRequest | null>(null);
  const advancingEpisodeRef = useRef(false);

  const play = useCallback((req: PlayNowRequest) => {
    stopAllAmbientVideo();
    setRequest(req);
  }, []);

  const close = useCallback(() => setRequest(null), []);

  const playNextEpisode = useCallback(async (current: PlayNowRequest) => {
    if (current.type !== "series" || !current.seriesId || current.seasonNumber == null || current.episodeNumber == null) return;
    if (advancingEpisodeRef.current) return;
    advancingEpisodeRef.current = true;
    try {
      const response = await fetch(
        `/api/library/series/${encodeURIComponent(current.seriesId)}/next?season=${encodeURIComponent(String(current.seasonNumber))}&episode=${encodeURIComponent(String(current.episodeNumber))}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = await response.json() as {
        next?: {
          seriesId: string; seriesTitle: string; seasonNumber: number; episodeNumber: number;
          title: string; plexRatingKey: string; plexUrl: string;
        } | null;
      };
      const next = data.next;
      if (!next) return;
      stopAllAmbientVideo();
      setRequest({
        ...current,
        ratingKey: next.plexRatingKey,
        movvizId: `${next.seriesId}:s${next.seasonNumber}e${next.episodeNumber}`,
        seriesId: next.seriesId,
        plexUrl: next.plexUrl,
        title: `${next.seriesTitle} — ${next.seasonNumber}x${String(next.episodeNumber).padStart(2, "0")} · ${next.title}`,
        seasonNumber: next.seasonNumber,
        episodeNumber: next.episodeNumber,
        // This is an automatic progression, not a user click from the page.
        originRect: undefined,
        startFromBeginning: true,
      });
    } catch {
      // End-of-episode must still complete normally if the next-item lookup
      // cannot reach the server.
    } finally {
      advancingEpisodeRef.current = false;
    }
  }, []);

  return (
    <PlayerCtx.Provider value={{ request, play, close }}>
      {children}
      <AnimatePresence>
        {request && (
          <TheaterModePlayer
            key={request.ratingKey}
            ratingKey={request.ratingKey}
            movvizId={request.movvizId}
            seriesId={request.seriesId}
            plexUrl={request.plexUrl}
            title={request.title}
            tmdbId={request.tmdbId}
            type={request.type}
            seasonNumber={request.seasonNumber}
            episodeNumber={request.episodeNumber}
            onClose={close}
            useTranscode={request.useTranscode}
            prebufferSeconds={PREBUFFER_SECONDS}
            originRect={request.originRect}
            backdropUrl={request.backdropUrl}
            posterUrl={request.posterUrl}
            startFromBeginning={request.startFromBeginning}
            onNextEpisode={request.type === "series" && request.seriesId ? () => void playNextEpisode(request) : undefined}
          />
        )}
      </AnimatePresence>
    </PlayerCtx.Provider>
  );
}

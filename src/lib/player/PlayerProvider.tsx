"use client";

import { createContext, useContext, useState, useCallback } from "react";
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
  plexUrl: string;
  title: string;
  useTranscode: boolean;
  /** TMDb identity of the watched item — lets Movviz record "quoi + quand"
   *  for direct playback (feeds the AI's recent-watches memory). */
  tmdbId?: number;
  type?: "movie" | "series";
  /** Clicked element's getBoundingClientRect() — feeds Theater Mode's expand-from-origin animation (Phase B). Undefined for a programmatic play with no click origin. */
  originRect?: OriginRect;
  backdropUrl?: string | null;
  posterUrl?: string | null;
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

  const play = useCallback((req: PlayNowRequest) => {
    stopAllAmbientVideo();
    setRequest(req);
  }, []);

  const close = useCallback(() => setRequest(null), []);

  return (
    <PlayerCtx.Provider value={{ request, play, close }}>
      {children}
      <AnimatePresence>
        {request && (
          <TheaterModePlayer
            key={request.ratingKey}
            ratingKey={request.ratingKey}
            plexUrl={request.plexUrl}
            title={request.title}
            tmdbId={request.tmdbId}
            type={request.type}
            onClose={close}
            useTranscode={request.useTranscode}
            prebufferSeconds={PREBUFFER_SECONDS}
            originRect={request.originRect}
            backdropUrl={request.backdropUrl}
            posterUrl={request.posterUrl}
          />
        )}
      </AnimatePresence>
    </PlayerCtx.Provider>
  );
}

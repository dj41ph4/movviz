import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
export interface EngineEpisodeCoordinate { season: number; episode: number; episodeEnd?: number }
export interface EpisodePresentation {
  seriesPart: "original" | "tybw";
  folder: string;
  title: string;
  year: number;
  plexGuid: string;
  imdbId?: string;
}
export interface EngineEpisodeTarget extends EngineEpisodeCoordinate {
  library?: EngineEpisodeCoordinate;
  placement?: EngineEpisodeCoordinate;
  presentation?: EpisodePresentation;
}
export interface EpisodePlacement {
  source: EngineEpisodeCoordinate;
  library: EngineEpisodeCoordinate;
  placement: EngineEpisodeCoordinate;
  presentation?: EpisodePresentation;
}
/** Never send an explicit placement to an older engine that would ignore it. */
export async function requireEpisodePlacementCapability(presentation = false) {
  const response = await fetch(`${ENGINE_BASE}/health`, { headers: engineHeaders(), cache: "no-store", signal: AbortSignal.timeout(5000) });
  const health = await response.json();
  if (!response.ok || health.capabilities?.episodePlacementV1 !== true || (presentation && health.capabilities?.episodePresentationV1 !== true)) throw new Error("bleach_engine_update_required");
}

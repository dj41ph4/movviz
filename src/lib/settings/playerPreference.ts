/** Legacy persisted key, current Movviz player semantics: opt-out, not opt-in. */
export function isMovvizPlayerEnabled(serverEnabled: boolean, personalEnabled?: boolean): boolean {
  return serverEnabled && personalEnabled !== false;
}

export function playerDestination(enabled: boolean, plexUrl?: string | null): "movviz" | string {
  return enabled ? "movviz" : (plexUrl || "https://app.plex.tv/desktop");
}

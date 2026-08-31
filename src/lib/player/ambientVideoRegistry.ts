/**
 * Imperative pub/sub so opening the real player can stop every ambient
 * background video (TrailerHeader instances) without prop-drilling through
 * every card/hero that happens to render one. Plain module state, not a
 * React context — this is a one-shot broadcast ("stop now"), not render
 * state anything needs to subscribe to for its own output.
 */
type StopFn = () => void;

const stopFns = new Set<StopFn>();

export function registerAmbientVideo(stop: StopFn): () => void {
  stopFns.add(stop);
  return () => stopFns.delete(stop);
}

export function stopAllAmbientVideo(): void {
  for (const stop of stopFns) stop();
}

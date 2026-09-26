import { eventBus } from "./EventBus";

/**
 * « Something this user watches changed » — seen/unseen, a resume position,
 * « Ma liste ». Every device of the same user (web, Android TV, phone)
 * listens on /api/events and reloads Reprendre / the checkmarks at once:
 * a change made on the PC shows up on the TV without waiting, and back.
 *
 * Coalesced per user: a Plex history import or a « whole season seen »
 * writes hundreds of views in a burst — one event after it, not hundreds.
 */
const COALESCE_MS = 400;
/** A playing video updates its position every 10 s: Reprendre elsewhere
 *  follows it at most this often (pause/stop/end always send at once). */
const PLAYBACK_MIN_INTERVAL_MS = 15_000;

const g = globalThis as typeof globalThis & {
  __movvizWatchEventTimers?: Map<string, ReturnType<typeof setTimeout>>;
  __movvizWatchEventLastPlayback?: Map<string, number>;
};
const timers = (g.__movvizWatchEventTimers ??= new Map());
const lastPlayback = (g.__movvizWatchEventLastPlayback ??= new Map());

export function emitWatchChanged(userId: string): void {
  if (!userId || timers.has(userId)) return;
  const timer = setTimeout(() => {
    timers.delete(userId);
    eventBus.emit({ type: "watch_changed", userId });
  }, COALESCE_MS);
  timer.unref?.();
  timers.set(userId, timer);
}

const aiTimers: Map<string, ReturnType<typeof setTimeout>> = ((g as typeof g & { __movvizAiChatEventTimers?: Map<string, ReturnType<typeof setTimeout>> }).__movvizAiChatEventTimers ??= new Map());
/** Short: a question and its answer are two separate changes a few seconds
 *  apart, each shown live on the user's other screens. */
const AI_COALESCE_MS = 150;

/** « Chat IA partagé » : the conversation continues on every device. */
export function emitAiChatChanged(userId: string): void {
  if (!userId || aiTimers.has(userId)) return;
  const timer = setTimeout(() => {
    aiTimers.delete(userId);
    eventBus.emit({ type: "ai_chat_changed", userId });
  }, AI_COALESCE_MS);
  timer.unref?.();
  aiTimers.set(userId, timer);
}

/** Position updates during playback: throttled (see PLAYBACK_MIN_INTERVAL_MS). */
export function emitPlaybackProgress(userId: string): void {
  const now = Date.now();
  if (now - (lastPlayback.get(userId) ?? 0) < PLAYBACK_MIN_INTERVAL_MS) return;
  lastPlayback.set(userId, now);
  emitWatchChanged(userId);
}

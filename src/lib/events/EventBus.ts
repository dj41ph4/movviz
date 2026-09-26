type Listener = (event: AppEvent) => void;

export type AppEvent =
  | { type: "movie_updated"; movieId: string }
  | { type: "series_updated"; seriesId: string }
  | { type: "download_changed" }
  | { type: "request_updated" }
  | { type: "notification_added" }
  | { type: "user_updated" }
  | { type: "activity_updated" }
  /** Seen/unseen, resume position or « Ma liste » of ONE user changed —
   *  sent only to that user's own devices (see /api/events). */
  | { type: "watch_changed"; userId: string }
  /** The Movviz AI conversation of ONE user changed (new message, card
   *  swapped, « Effacer ») — that user's other devices show it at once. */
  | { type: "ai_chat_changed"; userId: string };

const BUS_KEY = "__movviz_event_bus__";

function getBus() {
  if (!(globalThis as any)[BUS_KEY]) {
    const listeners = new Set<Listener>();
    (globalThis as any)[BUS_KEY] = {
      listeners,
      emit(event: AppEvent) {
        for (const fn of listeners) fn(event);
      },
      on(fn: Listener) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };
  }
  return (globalThis as any)[BUS_KEY] as {
    listeners: Set<Listener>;
    emit: (event: AppEvent) => void;
    on: (fn: Listener) => () => void;
  };
}

export const eventBus = {
  emit: (event: AppEvent) => getBus().emit(event),
  on: (fn: Listener) => getBus().on(fn),
  /** Connected listeners (one per open /api/events stream, plus in-process ones). */
  listenerCount: () => getBus().listeners.size,
};

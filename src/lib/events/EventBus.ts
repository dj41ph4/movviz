type Listener = (event: AppEvent) => void;

export type AppEvent =
  | { type: "movie_updated"; movieId: string }
  | { type: "series_updated"; seriesId: string }
  | { type: "download_changed" }
  | { type: "request_updated" }
  | { type: "notification_added" }
  | { type: "user_updated" }
  | { type: "activity_updated" };

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
};

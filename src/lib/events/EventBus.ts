type Listener = (event: LibraryEvent) => void;

export type LibraryEvent =
  | { type: "movie_updated"; movieId: string }
  | { type: "series_updated"; seriesId: string };

const BUS_KEY = "__movviz_event_bus__";

function getBus() {
  if (!(globalThis as any)[BUS_KEY]) {
    const listeners = new Set<Listener>();
    (globalThis as any)[BUS_KEY] = {
      listeners,
      emit(event: LibraryEvent) {
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
    emit: (event: LibraryEvent) => void;
    on: (fn: Listener) => () => void;
  };
}

export const eventBus = {
  emit: (event: LibraryEvent) => getBus().emit(event),
  on: (fn: Listener) => getBus().on(fn),
};

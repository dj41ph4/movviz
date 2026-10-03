import type { Lane } from "@/lib/priority/lane";

export type TmdbRequestQueueState = {
  active: number;
  waiters: Array<{ lane: Lane; start: () => void }>;
};

/** Reserves slots before waking waiters; preserves FIFO within each lane. */
export function createTmdbRequestSlots(
  state: TmdbRequestQueueState,
  backgroundSlots: number,
  userExtraSlots: number
) {
  function dispatch(): void {
    while (state.waiters.length > 0) {
      const userIndex = state.waiters.findIndex((waiter) => waiter.lane === "user");
      const index = userIndex >= 0 ? userIndex : 0;
      const next = state.waiters[index];
      const limit = backgroundSlots + (next.lane === "user" ? userExtraSlots : 0);
      if (state.active >= limit) return;
      state.waiters.splice(index, 1);
      state.active++;
      next.start();
    }
  }

  return async function withSlot<T>(lane: Lane, fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((start) => {
      state.waiters.push({ lane, start });
      dispatch();
    });
    try {
      return await fn();
    } finally {
      state.active--;
      dispatch();
    }
  };
}

import { eventBus } from "@/lib/events/EventBus";
const globals = globalThis as typeof globalThis & {
  __movvizRecommendationSubscriptions?: Map<string, Map<string, number>>;
  __movvizRecommendationUpdateTimers?: Map<string, ReturnType<typeof setTimeout>>;
};
const subscriptions = globals.__movvizRecommendationSubscriptions ??= new Map();
const timers = globals.__movvizRecommendationUpdateTimers ??= new Map();
let lastPrune = 0;
export function subscribeToRecommendationKeys(userId: string, keys: string[]) {
  if (!userId) return;
  const now = Date.now();
  if (now - lastPrune > 60_000) {
    lastPrune = now;
    for (const [key, users] of subscriptions) {
      for (const [id, at] of users) if (now - at > 5 * 60_000) users.delete(id);
      if (!users.size) subscriptions.delete(key);
    }
  }
  for (const key of keys) {
    const users = subscriptions.get(key) ?? new Map<string, number>();
    users.set(userId, now); subscriptions.set(key, users);
  }
}
export function recommendationKeyReady(key: string) {
  const users = subscriptions.get(key);
  if (!users) return;
  for (const [userId, at] of users) {
    if (Date.now() - at > 5 * 60_000) { users.delete(userId); continue; }
    if (timers.has(userId)) continue;
    const timer = setTimeout(() => {
      timers.delete(userId);
      eventBus.emit({ type: "recommendations_changed", userId });
    }, 10_000);
    timer.unref?.(); timers.set(userId, timer);
  }
  if (users.size === 0) subscriptions.delete(key);
}

const COOLDOWN_MS = 300_000;
const cache = new Map<string, number>();

export function isOnCooldown(id: string): boolean {
  const ts = cache.get(id);
  if (!ts) return false;
  if (Date.now() - ts >= COOLDOWN_MS) {
    cache.delete(id);
    return false;
  }
  return true;
}

export function markSearched(id: string): void {
  cache.set(id, Date.now());
}

export function getRemainingCooldown(id: string): number {
  const ts = cache.get(id);
  if (!ts) return 0;
  const remaining = COOLDOWN_MS - (Date.now() - ts);
  return remaining > 0 ? remaining : 0;
}

export function clearSearchCache(): void {
  cache.clear();
}

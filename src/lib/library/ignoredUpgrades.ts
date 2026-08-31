/**
 * Ignored upgrades — movies the user explicitly dismissed.
 * In-memory only (survives server restart via the ignored list being
 * re-evaluated — if the movie still has an upgrade candidate next scan,
 * the "Ignorer" button can be clicked again). Simple Map: movieId → true.
 */

const g = globalThis as typeof globalThis & { __movvizIgnoredUpgrades?: Map<string, boolean> };
const ignored = (g.__movvizIgnoredUpgrades ??= new Map<string, boolean>());

export function isUpgradeIgnored(movieId: string): boolean {
  return ignored.has(movieId);
}

export function ignoreUpgrade(movieId: string): void {
  ignored.set(movieId, true);
}

export function unignoreUpgrade(movieId: string): void {
  ignored.delete(movieId);
}

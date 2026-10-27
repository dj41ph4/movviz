/**
 * Attend que le serveur Movviz réponde de nouveau. Une mise à jour le redémarre en moins
 * d'une minute : à la reprise de la lecture, abandonner tout de suite avec « ouvrez-la dans
 * Plex » était faux — le flux revient dès que le serveur est reparti. Tant qu'il ne répond
 * pas, le lecteur reste en chargement.
 *
 * Renvoie true dès que /api/healthz répond 200 (immédiatement si le serveur est déjà
 * joignable), false si le délai est dépassé ou si `isStopped()` devient vrai (lecteur fermé).
 */
export const SERVER_BACK_MAX_WAIT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

export async function waitForServerBack(
  isStopped: () => boolean,
  opts: {
    maxWaitMs?: number;
    pollMs?: number;
    check?: () => Promise<boolean>;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  } = {},
): Promise<boolean> {
  const maxWaitMs = opts.maxWaitMs ?? SERVER_BACK_MAX_WAIT_MS;
  const pollMs = opts.pollMs ?? POLL_INTERVAL_MS;
  const check = opts.check ?? (async () => (await fetch("/api/healthz", { cache: "no-store" })).ok);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = opts.now ?? Date.now;
  const deadline = now() + maxWaitMs;
  while (now() < deadline) {
    if (isStopped()) return false;
    try {
      if (await check()) return true;
    } catch { /* serveur encore arrêté : on réessaie */ }
    await sleep(pollMs);
  }
  return false;
}

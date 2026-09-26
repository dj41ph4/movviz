import { engineGet } from "@/lib/engine/server";
import { eventBus } from "./EventBus";

/**
 * Downloads, event-driven too (demande explicite : « changement → le serveur
 * prévient → actualisation », jamais de rafraîchissement inutile). The
 * devices no longer poll the queue: the server looks at its own local
 * download engine while at least one device listens on /api/events, and
 * sends « download_changed » only when something really changed — a new
 * download (automatic grabs included), a state change, or progress moving
 * by at least 1 %. Nobody connected: nothing runs.
 */
const CHECK_EVERY_MS = 5_000;

interface EngineTorrent { infoHash: string; state?: string; progress?: number }

const g = globalThis as typeof globalThis & { __movvizDownloadWatcher?: { timer: ReturnType<typeof setTimeout> | null; signature: string | null } };
const watcher = (g.__movvizDownloadWatcher ??= { timer: null, signature: null });

function signatureOf(torrents: EngineTorrent[]): string {
  return torrents
    .map((t) => `${t.infoHash}:${t.state ?? ""}:${Math.floor((t.progress ?? 0) * 100)}`)
    .sort()
    .join("|");
}

async function check(): Promise<void> {
  watcher.timer = null;
  if (eventBus.listenerCount() === 0) {
    // Last device gone: stop, and forget the state so the next listener
    // starts from a fresh comparison.
    watcher.signature = null;
    return;
  }
  const data = await engineGet<{ torrents?: EngineTorrent[] }>("torrents");
  if (data?.torrents) {
    const signature = signatureOf(data.torrents);
    if (watcher.signature !== null && signature !== watcher.signature) eventBus.emit({ type: "download_changed" });
    watcher.signature = signature;
  }
  schedule();
}

function schedule(): void {
  if (watcher.timer) return;
  watcher.timer = setTimeout(() => { void check(); }, CHECK_EVERY_MS);
  watcher.timer.unref?.();
}

/** Called when a device connects to /api/events. */
export function ensureDownloadWatcher(): void {
  schedule();
}

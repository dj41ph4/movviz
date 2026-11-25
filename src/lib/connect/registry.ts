import { eventBus } from "@/lib/events/EventBus";
import { ONLINE_MS, type ConnectCommand, type ConnectDevice, type DeviceKind, type ReceiverState } from "./types";

interface Entry {
  id: string;
  userId: string;
  name: string;
  kind: DeviceKind;
  receiver: boolean;
  lastSeen: number;
  state: ReceiverState | null;
}

const KEY = "__movvizConnectRegistry";
const holder = globalThis as typeof globalThis & { [KEY]?: Map<string, Entry> };
const devices = (holder[KEY] ??= new Map<string, Entry>());

// ── Boîtes aux lettres (appareils sans flux SSE : TV Samsung) ──

interface Mailbox {
  seq: number;
  items: { seq: number; at: number; command: ConnectCommand }[];
  waiters: Set<() => void>;
}
const mailHolder = globalThis as typeof globalThis & { __movvizConnectMail?: Map<string, Mailbox> };
const mailboxes = (mailHolder.__movvizConnectMail ??= new Map<string, Mailbox>());
const MAIL_TTL_MS = 60_000;

function mailbox(userId: string, id: string): Mailbox {
  const key = streamKey(userId, id);
  let box = mailboxes.get(key);
  if (!box) {
    // Plafond : des identifiants inventés ne font pas grossir la mémoire sans fin.
    if (mailboxes.size >= 1000) for (const [k, b] of mailboxes) { if (!b.waiters.size) { mailboxes.delete(k); break; } }
    box = { seq: 0, items: [], waiters: new Set() };
    mailboxes.set(key, box);
  }
  return box;
}



/** Un appareil silencieux depuis longtemps est oublié (jamais gardé indéfiniment en mémoire). */
const FORGET_MS = 10 * 60_000;

/** Flux /api/events ouverts par appareil (clé « utilisateur:appareil ») : tant qu'il y en a un, l'appareil est en ligne, même onglet en veille. */
const streamsHolder = globalThis as typeof globalThis & { __movvizConnectStreams?: Map<string, number> };
const streams = (streamsHolder.__movvizConnectStreams ??= new Map<string, number>());
const streamKey = (userId: string, id: string) => `${userId}:${id}`;

function isOnline(d: Entry, now: number): boolean {
  return (streams.get(streamKey(d.userId, d.id)) ?? 0) > 0 || now - d.lastSeen <= ONLINE_MS;
}

function sweep(now: number) {
  for (const [id, d] of devices) {
    if (!isOnline(d, now) && now - d.lastSeen > FORGET_MS) {
      devices.delete(id);
      mailboxes.delete(streamKey(d.userId, id));
    }
  }
}

/** Un flux d'événements s'ouvre pour cet appareil ; renvoie la fermeture. */
export function attachStream(userId: string, id: string): () => void {
  const key = streamKey(userId, id);
  streams.set(key, (streams.get(key) ?? 0) + 1);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    const left = (streams.get(key) ?? 1) - 1;
    if (left <= 0) streams.delete(key);
    else streams.set(key, left);
    const d = devices.get(id);
    if (d && d.userId === userId) d.lastSeen = Date.now();
  };
}

export function registerDevice(userId: string, reg: { id: string; name: string; kind: DeviceKind; receiver: boolean }): void {
  const now = Date.now();
  sweep(now);
  const known = devices.get(reg.id);
  // Un identifiant appartient à un seul utilisateur : jamais récupéré par un autre compte.
  const mine = known && known.userId === userId ? known : null;
  const wasOnline = !!mine && isOnline(mine, now);
  const changed = !mine || mine.name !== reg.name || mine.receiver !== reg.receiver || !wasOnline;
  devices.set(reg.id, { ...reg, userId, lastSeen: now, state: mine ? mine.state : null });
  if (changed) eventBus.emit({ type: "connect_roster", userId });
}

export function removeDevice(userId: string, id: string): void {
  const d = devices.get(id);
  if (!d || d.userId !== userId) return;
  // Un autre onglet du même navigateur (même identifiant) écoute encore : l'appareil reste.
  if ((streams.get(streamKey(userId, id)) ?? 0) > 0) return;
  devices.delete(id);
  mailboxes.delete(streamKey(userId, id));
  eventBus.emit({ type: "connect_roster", userId });
}

export function listDevices(userId: string): ConnectDevice[] {
  const now = Date.now();
  sweep(now);
  return [...devices.values()]
    .filter((d) => d.userId === userId && isOnline(d, now))
    .map((d) => ({
      id: d.id,
      name: d.name,
      kind: d.kind,
      via: "movviz" as const,
      receiver: d.receiver,
      online: true,
      state: d.state,
    }))
    .sort((a, b) => Number(b.receiver) - Number(a.receiver) || a.name.localeCompare(b.name));
}

export function getDevice(userId: string, id: string): ConnectDevice | null {
  return listDevices(userId).find((d) => d.id === id) ?? null;
}

/** Pousse un ordre à l'appareil visé. Faux si l'appareil n'existe pas ou n'est plus en ligne. */
export function sendCommand(userId: string, targetId: string, command: ConnectCommand): boolean {
  const target = getDevice(userId, targetId);
  if (!target || !target.receiver) return false;
  // Boîte créée ici, pas à la première attente : un ordre envoyé juste après un redémarrage
  // du serveur, avant que la TV ne se remette à l'écoute, n'est plus perdu.
  const box = mailbox(userId, targetId);
  const now = Date.now();
  box.items = box.items.filter((i) => now - i.at < MAIL_TTL_MS).slice(-19);
  box.items.push({ seq: ++box.seq, at: now, command });
  for (const wake of [...box.waiters]) wake();
  eventBus.emit({ type: "connect_command", userId, targetId, command });
  return true;
}

export function reportState(userId: string, deviceId: string, state: ReceiverState): boolean {
  const d = devices.get(deviceId);
  if (!d || d.userId !== userId) return false;
  d.state = state.status === "idle" ? { ...state, position: 0, duration: 0 } : state;
  d.lastSeen = Date.now();
  eventBus.emit({ type: "connect_state", userId, deviceId, state: d.state });
  return true;
}

// ── Réception par attente longue (appareils sans flux SSE : TV Samsung) ──────

/**
 * Attend (au plus `timeoutMs`) les ordres arrivés après `after`. L'appareil reste
 * « en ligne » pendant l'attente. `after` absent : on part du dernier numéro (rien d'ancien n'est rejoué).
 */
export async function waitCommands(userId: string, id: string, after: number | null, timeoutMs: number, signal?: AbortSignal): Promise<{ seq: number; commands: ConnectCommand[] }> {
  const box = mailbox(userId, id);
  const from = after ?? box.seq;
  const pending = () => box.items.filter((i) => i.seq > from);
  if (!pending().length && after !== null && after > box.seq) {
    // Le serveur a redémarré : la numérotation repart de zéro.
    return { seq: box.seq, commands: [] };
  }
  if (!pending().length && !signal?.aborted) {
    const detach = attachStream(userId, id);
    try {
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          box.waiters.delete(done);
          signal?.removeEventListener("abort", done);
          resolve();
        };
        const timer = setTimeout(done, timeoutMs);
        box.waiters.add(done);
        signal?.addEventListener("abort", done);
      });
    } finally {
      detach();
    }
  }
  const items = pending();
  return { seq: items.length ? items[items.length - 1].seq : Math.max(from, box.seq), commands: items.map((i) => i.command) };
}

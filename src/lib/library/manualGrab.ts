import fs from "node:fs";
import path from "node:path";

/**
 * Marks a grab as USER-INITIATED (manual) so the post-import blocklist check
 * (checkPostImportBlockedWord in applyImportedFiles.ts) does not apply to it.
 *
 * Rationale: the pre-grab decision guard (decisionGuard.ts) filters automatic
 * grabs against the user's forbidden words, and the post-import check is the
 * second layer that catches releases whose REAL torrent name smuggles a
 * blocked term past that filter (indexer-advertised title vs actual torrent
 * name). But a manual grab is the user explicitly picking THIS release —
 * they saw the name (e.g. "VOSTFR") and chose it anyway. Quarantining it at
 * import time (file deleted + library reverted to "missing") turns a
 * deliberate choice into a silent data loss. So manual grabs are exempted:
 * they still get renamed/moved into the library exactly like any other
 * import, blocklist rules simply don't veto them.
 *
 * Keyed by the engine-resolved infoHash (the one identifier both the grab
 * response and the import callback share), lowercase-normalized, TTL-bounded
 * so a stalled/cancelled download never leaves a stale entry that a later
 * unrelated grab of the same release could inherit.
 *
 * Two things keep the exemption alive where it used to be lost:
 *  - a successful import no longer erases it at once: the engine can call the
 *    import back a second time for the same torrent (season pack, duplicate
 *    callback, recovery import) and that second call used to find no mark and
 *    delete the files the first one had just imported ("saison 1 est
 *    maintenant disponible" then, one second later, "téléchargement supprimé").
 *    The mark now stays for a short grace period after the import.
 *  - it is kept on disk, so a server restart in the middle of a download does
 *    not turn a manual grab back into an automatic one.
 */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** Délai pendant lequel l'exemption survit à un import réussi (rappels tardifs du moteur). */
const DONE_GRACE_MS = 30 * 60 * 1000;

interface ManualEntry {
  setAt: number;
  /** Posé au premier import réussi ; l'entrée expire DONE_GRACE_MS plus tard. */
  doneAt?: number;
}

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "manual-grabs.json");

const alive = (e: ManualEntry, now: number) =>
  now - e.setAt <= MAX_AGE_MS && (e.doneAt === undefined || now - e.doneAt <= DONE_GRACE_MS);

function loadFromDisk(): Map<string, ManualEntry> {
  const map = new Map<string, ManualEntry>();
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as Record<string, ManualEntry>;
      const now = Date.now();
      for (const [k, v] of Object.entries(raw)) if (v && typeof v.setAt === "number" && alive(v, now)) map.set(k, v);
    }
  } catch {
    // fichier absent ou corrompu : on repart à vide
  }
  return map;
}

const g = globalThis as typeof globalThis & { __movvizManualGrabs?: Map<string, ManualEntry> };
const manual = (g.__movvizManualGrabs ??= loadFromDisk());

function persist() {
  try {
    const now = Date.now();
    for (const [k, v] of manual) if (!alive(v, now)) manual.delete(k);
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.${now}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(manual)), "utf8");
    fs.renameSync(tmp, FILE);
  } catch (err) {
    console.error("[manualGrab] failed to persist:", err);
  }
}

/** Called right after the engine accepts a manual grab and resolves its infoHash. */
export function markManualGrab(infoHash: string) {
  manual.set(infoHash.toLowerCase(), { setAt: Date.now() });
  persist();
}

/**
 * Called once an import succeeded. The mark is NOT erased: it expires after a
 * short grace period, so a later callback for the same torrent is still
 * recognised as manual. True when the grab was manual.
 */
export function takeManualGrab(infoHash: string | undefined): boolean {
  if (!infoHash) return false;
  const entry = manual.get(infoHash.toLowerCase());
  if (!entry || !alive(entry, Date.now())) return false;
  if (entry.doneAt === undefined) {
    entry.doneAt = Date.now();
    persist();
  }
  return true;
}

/** Keep the exemption alive across a refused import's retries and late callbacks. */
export function peekManualGrab(infoHash: string | undefined): boolean {
  const entry = infoHash ? manual.get(infoHash.toLowerCase()) : undefined;
  return !!entry && alive(entry, Date.now());
}

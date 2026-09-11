import fs from "node:fs";
import path from "node:path";

/**
 * Photos de profil choisies par les utilisateurs (Réglages → Profil).
 *
 * Stockage fichier (jamais en JSON) : `{CONFIG_DIR}/avatars/{userId}.{ext}`,
 * servi en public par GET /api/avatars/[id] et prioritaire sur plexAvatar
 * via effectiveAvatar(). Le champ User.customAvatar contient l'URL publique
 * versionnée (`/api/avatars/{id}?v={mtime}`) pour invalider les caches client.
 *
 * Réplication vers Plex : AUCUN endpoint public/documenté ne permet
 * aujourd'hui de pousser une photo vers plex.tv (vérifié : ni python-plexapi
 * ni la doc communautaire n'en exposent — seule l'app officielle Plex sait
 * le faire via une API privée). Donc PAS de push : plexAvatar reste intact
 * et la photo Movviz vit sa vie côté Movviz. Si Plex documente un jour un
 * endpoint, c'est ici — dans tryPushAvatarToPlex() — qu'il s'implémentera,
 * avec le plexToken de l'utilisateur.
 */

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");

export const AVATARS_DIR = path.join(CONFIG_DIR, "avatars");

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

type AvatarKind = { ext: "png" | "jpg" | "webp" | "gif"; mime: string };

const KINDS: { magic: number[]; ext: AvatarKind["ext"]; mime: string }[] = [
  { magic: [0x89, 0x50, 0x4e, 0x47], ext: "png", mime: "image/png" },
  { magic: [0xff, 0xd8, 0xff], ext: "jpg", mime: "image/jpeg" },
  { magic: [0x47, 0x49, 0x46], ext: "gif", mime: "image/gif" },
];

function sniffKind(bytes: Uint8Array): AvatarKind | null {
  for (const k of KINDS) {
    if (k.magic.every((b, i) => bytes[i] === b)) return { ext: k.ext, mime: k.mime };
  }
  // WebP : RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

/** userId générés par Movviz (`usr_…`) — jamais de chemin injecté. */
export function isSafeUserId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

export function avatarFileFor(userId: string): { file: string; mime: string } | null {
  if (!isSafeUserId(userId)) return null;
  const candidates: { file: string; mime: string }[] = [
    { file: path.join(AVATARS_DIR, `${userId}.png`), mime: "image/png" },
    { file: path.join(AVATARS_DIR, `${userId}.jpg`), mime: "image/jpeg" },
    { file: path.join(AVATARS_DIR, `${userId}.jpeg`), mime: "image/jpeg" },
    { file: path.join(AVATARS_DIR, `${userId}.webp`), mime: "image/webp" },
    { file: path.join(AVATARS_DIR, `${userId}.gif`), mime: "image/gif" },
  ];
  for (const c of candidates) {
    try {
      if (fs.statSync(c.file).isFile()) return c;
    } catch { /* absent — suivant */ }
  }
  return null;
}

export function publicAvatarUrl(userId: string): string {
  return `/api/avatars/${userId}?v=${Date.now()}`;
}

export function saveAvatar(
  userId: string,
  bytes: Uint8Array,
): { url: string } | { error: "bad_user" | "too_big" | "bad_type" } {
  if (!isSafeUserId(userId)) return { error: "bad_user" };
  if (bytes.length === 0 || bytes.length > AVATAR_MAX_BYTES) return { error: "too_big" };
  const kind = sniffKind(bytes);
  if (!kind) return { error: "bad_type" };
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
  // Une seule photo par compte : on purge les anciennes extensions pour ne
  // jamais servir un fichier obsolète.
  for (const ext of ["png", "jpg", "jpeg", "webp", "gif"]) {
    const old = path.join(AVATARS_DIR, `${userId}.${ext}`);
    if (old.endsWith(`.${kind.ext}`)) continue;
    try {
      fs.rmSync(old, { force: true });
    } catch { /* absent — rien à purger */ }
  }
  // startsWith(AVATARS_DIR + sep) : garde-fou anti traversal (non-admin
  // users CANNOT delete hors scope — même règle que les suppressions).
  const file = path.join(AVATARS_DIR, `${userId}.${kind.ext}`);
  if (!file.startsWith(AVATARS_DIR + path.sep)) return { error: "bad_user" };
  fs.writeFileSync(file, bytes);
  return { url: publicAvatarUrl(userId) };
}

export function deleteAvatar(userId: string): void {
  if (!isSafeUserId(userId)) return;
  for (const ext of ["png", "jpg", "jpeg", "webp", "gif"]) {
    const file = path.join(AVATARS_DIR, `${userId}.${ext}`);
    if (!file.startsWith(AVATARS_DIR + path.sep)) continue;
    try {
      fs.rmSync(file, { force: true });
    } catch { /* absent — rien à purger */ }
  }
}

/**
 * Réplication vers Plex — NON IMPLÉMENTÉ volontairement : aucun endpoint
 * public/documenté ne permet de pousser une photo vers plex.tv (ni
 * python-plexapi ni la doc communautaire n'en exposent ; seule l'app
 * officielle utilise une API privée sujette à casser). Le plexToken de
 * l'utilisateur serait de toute façon requis — les comptes locaux/invités
 * n'en ont pas. Quand Plex documentera un endpoint, l'implémenter ici avec
 * (plexToken, bytes) et l'appeler après saveAvatar().
 */
export function tryPushAvatarToPlex(
  _plexToken: string | null,
  _bytes: Uint8Array,
): { pushed: false; reason: "no_public_endpoint" } {
  return { pushed: false, reason: "no_public_endpoint" };
}

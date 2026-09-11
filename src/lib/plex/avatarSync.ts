import { createHash } from "node:crypto";
import fs from "node:fs";
import { avatarFileFor } from "@/lib/avatars";
import { getUserById, updateUser } from "@/lib/auth/store";
import type { User } from "@/lib/auth/types";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { getPlexAccount, switchPlexHomeUser } from "./client";
import { loadPlexConfig } from "./store";

const PLEX_AVATAR_ENDPOINT = "https://clients.plex.tv/api/v2/user";

export function plexAvatarFingerprint(thumb: string | null | undefined): string | undefined {
  if (!thumb) return undefined;
  return `url:${createHash("sha256").update(thumb).digest("hex")}`;
}

async function fingerprintPlexThumb(thumb: string, auth: { clientId: string; token: string }): Promise<string | null> {
  try {
    const url = new URL(thumb);
    if (url.protocol !== "https:" || url.username || url.password || !(url.hostname === "plex.tv" || url.hostname.endsWith(".plex.tv"))) return null;
    const res = await fetch(url, {
      headers: { "X-Plex-Token": auth.token, "X-Plex-Client-Identifier": auth.clientId },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > 2 * 1024 * 1024) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > 2 * 1024 * 1024) return null;
    return `bytes:${createHash("sha256").update(bytes).digest("hex")}`;
  } catch {
    return null;
  }
}

/** First observation is a baseline and never erases a legacy custom avatar.
 * A later different fingerprint is positive evidence of a Plex-side change. */
export function plexAvatarRefreshPatch(user: User, thumb: string | null, observedAt = Date.now(), observedFingerprint?: string): Partial<User> | null {
  const fingerprint = observedFingerprint ?? plexAvatarFingerprint(thumb);
  if (!fingerprint) return null;
  if (fingerprint === user.plexAvatarFingerprint) {
    return user.plexAvatar === thumb ? null : { plexAvatar: thumb };
  }
  if (!user.plexAvatarFingerprint) {
    return { plexAvatar: thumb, plexAvatarFingerprint: fingerprint };
  }
  return {
    plexAvatar: thumb,
    plexAvatarFingerprint: fingerprint,
    customAvatar: null,
    avatarUpdatedAt: observedAt,
    avatarSource: "plex",
  };
}

async function accountToken(user: User): Promise<{ clientId: string; token: string } | null> {
  const cfg = loadPlexConfig();
  if (!cfg.clientId) return null;
  if (user.plexToken) return { clientId: cfg.clientId, token: user.plexToken };
  if (user.plexManagedUserId && cfg.adminToken) {
    const token = await switchPlexHomeUser(cfg.clientId, cfg.adminToken, user.plexManagedUserId);
    return token ? { clientId: cfg.clientId, token } : null;
  }
  if (user.role === "admin" && cfg.adminToken) return { clientId: cfg.clientId, token: cfg.adminToken };
  return null;
}

export async function refreshPlexAvatar(user: User): Promise<void> {
  const auth = await accountToken(user);
  if (!auth) return;
  const account = await getPlexAccount(auth.clientId, auth.token);
  if (!account?.thumb) return;
  const fingerprint = await fingerprintPlexThumb(account.thumb, auth);
  if (!fingerprint) return; // no proof, no state mutation
  const current = getUserById(user.id);
  if (!current) return;
  const patch = plexAvatarRefreshPatch(current, account.thumb, Date.now(), fingerprint);
  if (patch) updateUser(user.id, patch);
}

/** Private Plex-Web endpoint, isolated and strictly best-effort. The Movviz
 * file is already saved before this runs. Success is accepted only after a
 * GET returns a new thumb, so a changed/removed private endpoint cannot
 * corrupt local state or create a false sync loop. */
export async function tryPushAvatarToPlex(userId: string): Promise<boolean> {
  const user = getUserById(userId);
  const found = avatarFileFor(userId);
  if (!user || !found) return false;
  const auth = await accountToken(user);
  if (!auth) return false;

  try {
    const beforeAccount = await getPlexAccount(auth.clientId, auth.token);
    const beforeFingerprint = beforeAccount?.thumb ? await fingerprintPlexThumb(beforeAccount.thumb, auth) : null;
    // This snapshot necessarily predates the PUT. Remembering it prevents an
    // older, previously unobserved Plex change from beating today's Movviz
    // upload if the PUT then fails.
    if (beforeAccount?.thumb && beforeFingerprint) {
      updateUser(user.id, { plexAvatar: beforeAccount.thumb, plexAvatarFingerprint: beforeFingerprint });
    }
    const bytes = fs.readFileSync(found.file);
    const form = new FormData();
    form.append("avatar", new Blob([bytes], { type: found.mime }), `avatar.${found.file.split(".").pop() ?? "jpg"}`);
    const res = await fetch(PLEX_AVATAR_ENDPOINT, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "X-Plex-Token": auth.token,
        "X-Plex-Client-Identifier": auth.clientId,
        "X-Plex-Product": "Movviz",
      },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      recordSearchLog("warn", "plex.avatarSync", `${user.username}: PUT avatar Plex refusé (${res.status}), avatar Movviz conservé.`);
      return false;
    }
    const account = await getPlexAccount(auth.clientId, auth.token);
    const fingerprint = account?.thumb ? await fingerprintPlexThumb(account.thumb, auth) : null;
    if (!account?.thumb || !fingerprint || fingerprint === beforeFingerprint) {
      recordSearchLog("warn", "plex.avatarSync", `${user.username}: PUT accepté mais nouvel avatar Plex non confirmé, avatar Movviz conservé.`);
      return false;
    }
    updateUser(user.id, { plexAvatar: account.thumb, plexAvatarFingerprint: fingerprint });
    recordSearchLog("info", "plex.avatarSync", `${user.username}: avatar Movviz répliqué vers Plex et vérifié.`);
    return true;
  } catch (error) {
    recordSearchLog("warn", "plex.avatarSync", `${user.username}: Plex inaccessible (${error instanceof Error ? error.message : "erreur"}), avatar Movviz conservé.`);
    return false;
  }
}

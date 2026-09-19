import { createHash } from "node:crypto";
import type { User } from "@/lib/auth/types";
import { loadPlexConfig, savePlexConfig } from "./store";
import { getPlexAccount, getPlexFriends, getPlexHomeUsers, getLocalAccounts, getPlexServerAccessToken, getServerIdentity, switchPlexHomeUser } from "./client";
import type { PlexServerConfig } from "./types";
import { getUserById, updateUser } from "@/lib/auth/store";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

/**
 * Runtime context for ONE Movviz user against ONE Plex Media Server.
 * Centralises all identity/token resolution so callers never fallback to
 * adminToken silently (§6, §76).
 */
export type PlexUserContext = {
  movvizUserId: string;
  plexAccountId?: string; // cloud plex.tv id (plexId) if applicable
  plexManagedUserId?: string;
  plexUsername?: string;
  plexTitle?: string;
  machineIdentifier: string;
  serverToken: string;
  tokenFingerprint: string; // sha256(token).slice(0,8) for logs
  authSource: "owner" | "account" | "managed";
  resolvedAt: number;
  localAccountId: number; // PMS-local id (for /status/sessions/history/all accountID filter)
  localAccountName: string;
};

type ResolveResult =
  | { ok: true; ctx: PlexUserContext }
  | { ok: false; reason: string; code: "NOT_CONFIGURED" | "NO_PLEX_IDENTITY" | "IDENTITY_UNRESOLVED" | "TOKEN_FAILED" | "SERVER_ID_FAILED" | "LOCAL_ACCOUNT_MISSING" };

const g = globalThis as typeof globalThis & {
  __movvizPlexUserContextCache?: Map<string, { ctx: PlexUserContext; expiresAt: number }>;
  __movvizPlexUserContextLocks?: Map<string, Promise<ResolveResult>>;
};

function ctxCache(): Map<string, { ctx: PlexUserContext; expiresAt: number }> {
  return (g.__movvizPlexUserContextCache ??= new Map());
}
function ctxLocks(): Map<string, Promise<ResolveResult>> {
  return (g.__movvizPlexUserContextLocks ??= new Map());
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export function fingerprintToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 8);
}

function isOwnerAccount(user: User, cfg: PlexServerConfig): boolean {
  return user.role === "admin" && !!cfg.adminToken && user.plexToken === cfg.adminToken;
}

async function ensureMachineIdentifier(cfg: PlexServerConfig): Promise<string | null> {
  if (cfg.machineIdentifier) return cfg.machineIdentifier;
  const mid = await getServerIdentity(cfg);
  if (!mid) return null;
  savePlexConfig({ ...cfg, machineIdentifier: mid });
  return mid;
}

/**
 * Single function to resolve Plex identity for a Movviz user (§8).
 * Never falls back to adminToken for personal data.
 * Used by all personal Plex operations (watched, progress, history, On Deck, etc.).
 */
export async function resolvePlexUserContext(movvizUserId: string): Promise<ResolveResult> {
  const cached = ctxCache().get(movvizUserId);
  if (cached && cached.expiresAt > Date.now()) return { ok: true, ctx: cached.ctx };

  // Deduplicate concurrent resolves for same user
  const existingLock = ctxLocks().get(movvizUserId);
  if (existingLock) return existingLock;

  const promise = doResolve(movvizUserId);
  ctxLocks().set(movvizUserId, promise);
  try {
    const result = await promise;
    if (result.ok) {
      ctxCache().set(movvizUserId, { ctx: result.ctx, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return result;
  } finally {
    ctxLocks().delete(movvizUserId);
  }
}

async function doResolve(movvizUserId: string): Promise<ResolveResult> {
  const user = getUserById(movvizUserId);
  if (!user) return { ok: false, reason: "Movviz user not found", code: "NO_PLEX_IDENTITY" };
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return { ok: false, reason: "Plex not configured", code: "NOT_CONFIGURED" };
  }
  const rawAccountId = user.plexId ?? user.plexManagedUserId;
  if (!rawAccountId) {
    return { ok: false, reason: `${user.username}: no plexId nor plexManagedUserId`, code: "NO_PLEX_IDENTITY" };
  }

  const machineIdentifier = await ensureMachineIdentifier(cfg);
  if (!machineIdentifier) {
    return { ok: false, reason: "Failed to resolve machineIdentifier", code: "SERVER_ID_FAILED" };
  }

  // 1) Determine authSource and PMS token
  // Owner: adminToken is already PMS token
  if (isOwnerAccount(user, cfg) && cfg.adminToken) {
    const localAccounts = await getLocalAccounts(cfg, cfg.adminToken);
    const ownerName = (await getPlexAccount(cfg.clientId, cfg.adminToken))?.username ?? null;
    const match = ownerName
      ? localAccounts.find((a) => a.name.trim().localeCompare(ownerName.trim(), undefined, { sensitivity: "base" }) === 0)
      : undefined;
    // Owner is conventionally id 1; if name match fails, fallback to 1 but log
    const local = match ?? localAccounts.find((a) => a.id === 1) ?? localAccounts[0];
    if (!local) {
      return { ok: false, reason: `${user.username}: no local account for owner`, code: "LOCAL_ACCOUNT_MISSING" };
    }
    const ctx: PlexUserContext = {
      movvizUserId: user.id,
      plexAccountId: user.plexId ?? undefined,
      plexManagedUserId: user.plexManagedUserId ?? undefined,
      plexUsername: ownerName ?? undefined,
      machineIdentifier,
      serverToken: cfg.adminToken,
      tokenFingerprint: fingerprintToken(cfg.adminToken),
      authSource: "owner",
      resolvedAt: Date.now(),
      localAccountId: local.id,
      localAccountName: local.name,
    };
    recordSearchLog("info", "plex.identity", `plex.identity user=${user.username} plexAccountId=${user.plexId ?? "-"} binding=owner server=${machineIdentifier.slice(0,8)} tokenFp=${ctx.tokenFingerprint} localAccountId=${local.id} status=resolved`);
    return { ok: true, ctx };
  }

  // 2) Managed Home user: need switch -> accountToken -> serverToken
  if (user.plexManagedUserId) {
    // Use cached plexServerToken if still valid for this machine?
    // But we still need localAccountId. Verify token's server access still works.
    let serverToken = user.plexServerToken ?? null;
    let plexTitle: string | undefined;
    // Resolve title for diagnostics
    const homeUsers = await getPlexHomeUsers(cfg.adminToken);
    const homeEntry = homeUsers.find((h) => h.id === user.plexManagedUserId);
    plexTitle = homeEntry?.title;

    // Find local account by title (managed users appear by title in /accounts)
    const localAccounts = await getLocalAccounts(cfg, cfg.adminToken);
    const local = plexTitle
      ? localAccounts.find((a) => a.name.trim().localeCompare(plexTitle!.trim(), undefined, { sensitivity: "base" }) === 0)
      : undefined;
    if (!local) {
      recordSearchLog("warn", "plex.identity", `plex.identity user=${user.username} plexManagedUserId=${user.plexManagedUserId} title=${plexTitle ?? "-"} status=unresolved reason=local_account_missing server=${machineIdentifier.slice(0,8)}`);
      return { ok: false, reason: `${user.username} (managed ${user.plexManagedUserId}): local account not found for title ${plexTitle ?? "?"}`, code: "LOCAL_ACCOUNT_MISSING" };
    }

    if (!serverToken) {
      const accountToken = await switchPlexHomeUser(cfg.clientId, cfg.adminToken, user.plexManagedUserId);
      if (!accountToken) {
        recordSearchLog("warn", "plex.identity", `plex.identity user=${user.username} plexManagedUserId=${user.plexManagedUserId} status=unresolved reason=switch_failed`);
        return { ok: false, reason: `${user.username}: switchPlexHomeUser failed for ${user.plexManagedUserId}`, code: "TOKEN_FAILED" };
      }
      const st = await getPlexServerAccessToken(cfg.clientId, accountToken, machineIdentifier);
      if (!st) {
        recordSearchLog("warn", "plex.profileAuth", `${user.username}: Plex n'a pas fourni de jeton d'accès pour ce serveur — données Plex personnelles ignorées`);
        return { ok: false, reason: `${user.username}: getPlexServerAccessToken failed for managed`, code: "TOKEN_FAILED" };
      }
      serverToken = st;
      updateUser(user.id, { plexServerToken: serverToken });
    }
    const ctx: PlexUserContext = {
      movvizUserId: user.id,
      plexManagedUserId: user.plexManagedUserId,
      plexAccountId: user.plexId ?? undefined,
      plexTitle,
      machineIdentifier,
      serverToken,
      tokenFingerprint: fingerprintToken(serverToken),
      authSource: "managed",
      resolvedAt: Date.now(),
      localAccountId: local.id,
      localAccountName: local.name,
    };
    recordSearchLog("info", "plex.identity", `plex.identity user=${user.username} plexManagedUserId=${user.plexManagedUserId} title=${plexTitle ?? "-"} binding=managed server=${machineIdentifier.slice(0,8)} tokenFp=${ctx.tokenFingerprint} localAccountId=${local.id} status=resolved`);
    return { ok: true, ctx };
  }

  // 3) Shared Plex account (friend) – use plexId (cloud id) -> resolve via getPlexFriends, then resources exchange
  if (user.plexId) {
    const friends = await getPlexFriends(cfg.clientId, cfg.adminToken);
    const friend = friends.find((f) => f.id === user.plexId);
    const plexUsername = friend?.username ?? null;
    // If friend not in list but user has plexToken, try getPlexAccount as fallback
    let resolvedUsername = plexUsername;
    if (!resolvedUsername && user.plexToken) {
      const acc = await getPlexAccount(cfg.clientId, user.plexToken);
      resolvedUsername = acc?.username ?? null;
    }
    const localAccounts = await getLocalAccounts(cfg, cfg.adminToken);
    const local = resolvedUsername
      ? localAccounts.find((a) => a.name.trim().localeCompare(resolvedUsername!.trim(), undefined, { sensitivity: "base" }) === 0)
      : undefined;
    // For external friends, local account name SHOULD match plexUsername; if not, we cannot safely map to local id -> fail closed
    if (!local) {
      recordSearchLog("warn", "plex.identity", `plex.identity user=${user.username} plexId=${user.plexId} plexUsername=${resolvedUsername ?? "-"} status=unresolved reason=local_account_missing server=${machineIdentifier.slice(0,8)} friends=${friends.length}`);
      return { ok: false, reason: `${user.username} (plexId:${user.plexId}): local account not found for username ${resolvedUsername ?? "?"}`, code: "LOCAL_ACCOUNT_MISSING" };
    }
    // Need serverToken – use cached if exists, else exchange via resources
    let serverToken = user.plexServerToken ?? null;
    if (!serverToken) {
      let accountToken = user.plexToken ?? null;
      // If no personal token, we cannot get serverToken? But we can try to use adminToken to fetch friend's access? No – Plex resources endpoint requires accountToken.
      // For friend accounts that never logged in via Movviz, we have no plexToken. This is known gap (§11).
      // We will fail closed rather than fallback to admin token.
      if (!accountToken) {
        recordSearchLog("warn", "plex.identity", `plex.identity user=${user.username} plexId=${user.plexId} status=unresolved reason=no_account_token_for_friend`);
        return { ok: false, reason: `${user.username}: friend account ${user.plexId} has no plexToken to exchange for server token`, code: "TOKEN_FAILED" };
      }
      const st = await getPlexServerAccessToken(cfg.clientId, accountToken, machineIdentifier);
      if (!st) {
        recordSearchLog("warn", "plex.profileAuth", `${user.username}: Plex n'a pas fourni de jeton d'accès pour ce serveur — données Plex personnelles ignorées`);
        return { ok: false, reason: `${user.username}: getPlexServerAccessToken failed for friend`, code: "TOKEN_FAILED" };
      }
      serverToken = st;
      updateUser(user.id, { plexServerToken: serverToken });
    }
    const ctx: PlexUserContext = {
      movvizUserId: user.id,
      plexAccountId: user.plexId,
      plexUsername: resolvedUsername ?? undefined,
      machineIdentifier,
      serverToken,
      tokenFingerprint: fingerprintToken(serverToken),
      authSource: "account",
      resolvedAt: Date.now(),
      localAccountId: local.id,
      localAccountName: local.name,
    };
    recordSearchLog("info", "plex.identity", `plex.identity user=${user.username} plexId=${user.plexId} username=${resolvedUsername ?? "-"} binding=account server=${machineIdentifier.slice(0,8)} tokenFp=${ctx.tokenFingerprint} localAccountId=${local.id} status=resolved`);
    return { ok: true, ctx };
  }

  return { ok: false, reason: `${user.username}: no identity path`, code: "IDENTITY_UNRESOLVED" };
}

/** Invalidate cache for one user (on token change, machineId change, etc.) */
export function invalidatePlexUserContext(movvizUserId: string): void {
  ctxCache().delete(movvizUserId);
}

/** Invalidate all cached contexts (on config change) */
export function invalidateAllPlexUserContexts(): void {
  ctxCache().clear();
}

export function getCachedPlexUserContext(movvizUserId: string): PlexUserContext | null {
  const hit = ctxCache().get(movvizUserId);
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit.ctx;
}

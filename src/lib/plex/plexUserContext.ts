import { createHash } from "node:crypto";
import type { User } from "@/lib/auth/types";
import { loadPlexConfig, savePlexConfig } from "./store";
import { getPlexAccount, getPlexHomeUsers, getLocalAccounts, getPlexServerAccessToken, getServerIdentity, getSharedServers, switchPlexHomeUser } from "./client";
import type { PlexServerConfig } from "./types";
import { getUserById, updateUser } from "@/lib/auth/store";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { getBinding, upsertBinding, type BindingSource } from "./plexBindingStore";

/**
 * Runtime context for ONE Movviz user against ONE Plex Media Server.
 * Centralises all identity/token resolution so callers never fallback to
 * adminToken silently (§6, §76).
 */

// Distinct type brands (§5)
export type MovvizUserId = string & { __brand: "MovvizUserId" };
export type PlexCloudAccountId = string & { __brand: "PlexCloudAccountId" };
export type PlexManagedUserId = string & { __brand: "PlexManagedUserId" };
export type PlexLocalAccountId = number & { __brand: "PlexLocalAccountId" };
export type PlexMachineIdentifier = string & { __brand: "PlexMachineIdentifier" };

export type PlexUserContext = {
  movvizUserId: string;
  plexAccountId?: string; // cloud plex.tv id (plexId) if applicable
  plexManagedUserId?: string;
  plexUsername?: string;
  plexTitle?: string;
  machineIdentifier: string;
  serverToken: string;
  tokenFingerprint: string; // sha256(token).slice(0,8) for logs
  authSource: "owner" | "managed" | "shared";
  accountTokenSource: "OWNER" | "ACCOUNT" | "HOME_SWITCH" | "SHARED";
  bindingSource: BindingSource;
  resolvedAt: number;
  // PMS-local id for the /status/sessions/history/all accountID filter.
  // NULL = unknown: history poll is unavailable, but snapshot/quickVerify/
  // watched-state reads via serverToken still work. NEVER blocks RESOLVED.
  localAccountId: number | null;
  localAccountName: string;
  historyAvailable: boolean;
};

type ResolveResult =
  | { ok: true; ctx: PlexUserContext }
  | { ok: false; reason: string; code: "NOT_CONFIGURED" | "NO_PLEX_IDENTITY" | "IDENTITY_UNRESOLVED" | "TOKEN_FAILED" | "SERVER_ID_FAILED" | "LOCAL_ACCOUNT_MISSING" | "AMBIGUOUS" | "ACCESS_DENIED" | "NO_SERVER_ACCESS" | "NOT_IN_HOME" | "NOT_IN_SHARED" | "NO_LOCAL_BINDING" | "NO_PERSONAL_TOKEN" };

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

  // Check existing binding first (§6)
  const existingBinding = getBinding(user.id, machineIdentifier);
  if (existingBinding) {
    // Validate that binding's localAccount still exists and token still works
    const localAccounts = await getLocalAccounts(cfg, cfg.adminToken);
    const stillExists = localAccounts.find((a) => a.id === existingBinding.localAccountId);
    if (stillExists) {
      // Try to re-resolve serverToken quickly via cached plexServerToken or re-exchange
      // For now, attempt to return cached context if plexServerToken still valid – we will re-validate token below via lightweight check
      // Instead, we proceed to re-resolve token path that matches bindingSource, but reuse binding's localAccount
      const ctx = await resolveViaBinding(user, cfg, machineIdentifier, existingBinding);
      if (ctx.ok) return ctx;
      // If binding-based resolve fails with TOKEN_FAILED, we fall through to full re-resolve (maybe token expired)
    }
  }

  // 1) Determine authSource and PMS token
  // Owner: adminToken is already PMS token
  if (isOwnerAccount(user, cfg) && cfg.adminToken) {
    const localAccounts = await getLocalAccounts(cfg, cfg.adminToken);
    const ownerName = (await getPlexAccount(cfg.clientId, cfg.adminToken))?.username ?? null;
    const match = ownerName
      ? localAccounts.find((a) => a.name.trim().localeCompare(ownerName.trim(), undefined, { sensitivity: "base" }) === 0)
      : undefined;
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
      accountTokenSource: "OWNER",
      bindingSource: "OWNER_EXACT",
      resolvedAt: Date.now(),
      localAccountId: local.id,
      localAccountName: local.name,
      historyAvailable: true,
    };
    upsertBinding({
      movvizUserId: user.id,
      plexAccountId: user.plexId ?? undefined,
      plexManagedUserId: user.plexManagedUserId ?? undefined,
      machineIdentifier,
      localAccountId: local.id,
      localAccountName: local.name,
      bindingSource: "OWNER_EXACT",
      verifiedAt: Date.now(),
      tokenFingerprint: ctx.tokenFingerprint,
    });
    recordSearchLog("info", "plex.identity", `plex.identity user=${user.username} plexAccountId=${user.plexId ?? "-"} binding=owner server=${machineIdentifier.slice(0,8)} tokenFp=${ctx.tokenFingerprint} localAccountId=${local.id} status=resolved`);
    return { ok: true, ctx };
  }

  // 2) Managed Home user: need switch -> accountToken -> serverToken
  if (user.plexManagedUserId) {
    let serverToken = user.plexServerToken ?? null;
    let plexTitle: string | undefined;
    const homeUsers = await getPlexHomeUsers(cfg.adminToken);
    const homeEntry = homeUsers.find((h) => h.id === user.plexManagedUserId);
    plexTitle = homeEntry?.title;
    if (!homeEntry) {
      recordSearchLog("warn", "plex.identity", `plex.identity user=${user.username} plexManagedUserId=${user.plexManagedUserId} status=unresolved reason=not_in_home homeUsers=${homeUsers.length}`);
      return { ok: false, reason: `${user.username} (managed ${user.plexManagedUserId}): not in Plex Home`, code: "NOT_IN_HOME" };
    }

    const localAccounts = await getLocalAccounts(cfg, cfg.adminToken);
    const local = plexTitle
      ? localAccounts.find((a) => a.name.trim().localeCompare(plexTitle!.trim(), undefined, { sensitivity: "base" }) === 0)
      : undefined;
    if (!local) {
      recordSearchLog("warn", "plex.identity", `plex.identity user=${user.username} plexManagedUserId=${user.plexManagedUserId} title=${plexTitle ?? "-"} status=unresolved reason=local_account_missing server=${machineIdentifier.slice(0,8)} localAccounts=${localAccounts.map((a)=>a.name).join(",")}`);
      return { ok: false, reason: `${user.username} (managed ${user.plexManagedUserId}): local account not found for title ${plexTitle ?? "?"}`, code: "NO_LOCAL_BINDING" };
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
        return { ok: false, reason: `${user.username}: getPlexServerAccessToken failed for managed (no server access)`, code: "NO_SERVER_ACCESS" };
      }
      serverToken = st;
      updateUser(user.id, { plexServerToken: serverToken });
    }
    // Validate token with a lightweight call (e.g., server identity via that token) – best-effort
    const tokenValid = await validatePlexServerToken(cfg, serverToken);
    if (!tokenValid) {
      // Invalidate and retry once (§8)
      updateUser(user.id, { plexServerToken: null });
      invalidatePlexUserContext(user.id);
      const accountToken = await switchPlexHomeUser(cfg.clientId, cfg.adminToken, user.plexManagedUserId);
      if (accountToken) {
        const st2 = await getPlexServerAccessToken(cfg.clientId, accountToken, machineIdentifier);
        if (st2) {
          serverToken = st2;
          updateUser(user.id, { plexServerToken: serverToken });
        } else {
          return { ok: false, reason: `${user.username}: re-exchange failed for managed`, code: "TOKEN_FAILED" };
        }
      } else {
        return { ok: false, reason: `${user.username}: switch retry failed`, code: "TOKEN_FAILED" };
      }
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
      accountTokenSource: "HOME_SWITCH",
      bindingSource: "HOME_EXACT",
      resolvedAt: Date.now(),
      localAccountId: local.id,
      localAccountName: local.name,
      historyAvailable: true,
    };
    upsertBinding({
      movvizUserId: user.id,
      plexManagedUserId: user.plexManagedUserId,
      plexAccountId: user.plexId ?? undefined,
      machineIdentifier,
      localAccountId: local.id,
      localAccountName: local.name,
      bindingSource: "HOME_EXACT",
      verifiedAt: Date.now(),
      tokenFingerprint: ctx.tokenFingerprint,
    });
    recordSearchLog("info", "plex.identity", `plex.identity user=${user.username} plexManagedUserId=${user.plexManagedUserId} title=${plexTitle ?? "-"} binding=managed server=${machineIdentifier.slice(0,8)} tokenFp=${ctx.tokenFingerprint} localAccountId=${local.id} status=resolved`);
    return { ok: true, ctx };
  }

  // 3) Shared server user – plexId (cloud id) mapped DIRECTLY onto the server's
  // own share list (`GET /api/servers/{machineId}/shared_servers`, owner token).
  // NEVER via /api/v2/friends (social graph ≠ server access). The share's own
  // accessToken authenticates PMS reads AS THIS USER – no personal Movviz
  // login required. ID match only, no name matching.
  if (user.plexId) {
    const shares = await getSharedServers(cfg.clientId, cfg.adminToken, machineIdentifier);
    if (shares === null) {
      recordSearchLog("warn", "plex.identity", `plex.identity user=${user.username} plexId=${user.plexId} status=unresolved reason=shared_servers_unreachable server=${machineIdentifier.slice(0, 8)}`);
      return { ok: false, reason: `${user.username}: shared_servers endpoint unreachable`, code: "TOKEN_FAILED" };
    }
    const share = shares.find((s) => s.userId === user.plexId);
    if (!share) {
      recordSearchLog("warn", "plex.identity", `plex.identity user=${user.username} plexId=${user.plexId} status=unresolved reason=not_in_shared_servers shares=${shares.length}`);
      return { ok: false, reason: `${user.username} (plexId:${user.plexId}): not in this server's shared users`, code: "NOT_IN_SHARED" };
    }
    // RÈGLE ABSOLUE : un share valide + accessToken valide = RESOLVED, même
    // sans localAccountId. Le local n'est résolu qu'en second temps, dans
    // l'ordre : 1. binding existant confirmé, 2. EXACT share.username ==
    // PMS /accounts name, 3. sinon null (history indisponible, snapshot OK).
    // Jamais de fuzzy, de first-account, d'owner ou d'id 1 par défaut.
    const existingShareBinding = getBinding(user.id, machineIdentifier);
    const localAccounts = await getLocalAccounts(cfg, cfg.adminToken);
    const confirmedLocal = existingShareBinding
      ? localAccounts.find((a) => a.id === existingShareBinding.localAccountId) ?? null
      : null;
    const exactLocal = localAccounts.find((a) => a.name.trim().localeCompare(share.username.trim(), undefined, { sensitivity: "base" }) === 0) ?? null;
    const local = confirmedLocal ?? exactLocal;
    if (!local) {
      recordSearchLog("info", "plex.identity", `plex.identity user=${user.username} plexId=${user.plexId} username=${share.username} status=resolved_no_local localAccounts=${localAccounts.map((a) => a.name).join(",")} historyAvailable=false`);
    }
    // Share accessToken first (it IS this user's PMS credential); cached
    // plexServerToken (previously persisted from a share) as fallback.
    let serverToken = share.accessToken ?? user.plexServerToken ?? null;
    if (!serverToken) {
      recordSearchLog("warn", "plex.identity", `plex.identity user=${user.username} plexId=${user.plexId} share=${share.shareId} accepted=${share.accepted} status=unresolved reason=no_share_access_token`);
      return { ok: false, reason: `${user.username}: share has no access token (invite pending?) and no cached server token`, code: "NO_SERVER_ACCESS" };
    }
    const tokenValid = await validatePlexServerToken(cfg, serverToken);
    if (!tokenValid) {
      // Token rotated or revoked: re-fetch shares ONCE, retry with the fresh share token.
      updateUser(user.id, { plexServerToken: null });
      invalidatePlexUserContext(user.id);
      const fresh = await getSharedServers(cfg.clientId, cfg.adminToken, machineIdentifier);
      const freshToken = fresh?.find((s) => s.userId === user.plexId)?.accessToken ?? null;
      if (!freshToken || !(await validatePlexServerToken(cfg, freshToken))) {
        recordSearchLog("warn", "plex.identity", `plex.identity user=${user.username} plexId=${user.plexId} status=unresolved reason=share_token_invalid`);
        return { ok: false, reason: `${user.username}: share access token invalid`, code: "TOKEN_FAILED" };
      }
      serverToken = freshToken;
    }
    if (user.plexServerToken !== serverToken) updateUser(user.id, { plexServerToken: serverToken });

    const ctx: PlexUserContext = {
      movvizUserId: user.id,
      plexAccountId: user.plexId,
      plexUsername: share.username,
      machineIdentifier,
      serverToken,
      tokenFingerprint: fingerprintToken(serverToken),
      authSource: "shared",
      accountTokenSource: "SHARED",
      bindingSource: "ACCOUNT_EXACT",
      resolvedAt: Date.now(),
      localAccountId: local?.id ?? null,
      localAccountName: local?.name ?? share.username,
      historyAvailable: local != null,
    };
    // Persist the binding only when a local account is confirmed — a null
    // local must never be written as a fake mapping.
    if (local) {
      upsertBinding({
        movvizUserId: user.id,
        plexAccountId: user.plexId,
        machineIdentifier,
        localAccountId: local.id,
        localAccountName: local.name,
        bindingSource: "ACCOUNT_EXACT",
        verifiedAt: Date.now(),
        tokenFingerprint: ctx.tokenFingerprint,
      });
    }
    recordSearchLog("info", "plex.identity", `plex.identity user=${user.username} source=shared plexId=${user.plexId} server=${machineIdentifier.slice(0, 8)} tokenFp=${ctx.tokenFingerprint} localAccountId=${local?.id ?? "null"} historyAvailable=${local != null} status=resolved`);
    return { ok: true, ctx };
  }

  return { ok: false, reason: `${user.username}: no identity path`, code: "IDENTITY_UNRESOLVED" };
}

async function resolveViaBinding(user: User, cfg: PlexServerConfig, machineIdentifier: string, binding: import("./plexBindingStore").PlexAccountBinding): Promise<ResolveResult> {
  // Try to reconstruct context from binding + current user tokens
  // We need serverToken – try cached plexServerToken first, then re-exchange if needed
  let serverToken = user.plexServerToken ?? null;
  if (isOwnerAccount(user, cfg) && cfg.adminToken) {
    const ctx: PlexUserContext = {
      movvizUserId: user.id,
      plexAccountId: user.plexId ?? undefined,
      plexManagedUserId: user.plexManagedUserId ?? undefined,
      machineIdentifier,
      serverToken: cfg.adminToken,
      tokenFingerprint: fingerprintToken(cfg.adminToken),
      authSource: "owner",
      accountTokenSource: "OWNER",
      bindingSource: binding.bindingSource,
      resolvedAt: Date.now(),
      localAccountId: binding.localAccountId,
      localAccountName: binding.localAccountName,
      historyAvailable: true,
    };
    return { ok: true, ctx };
  }
  if (user.plexManagedUserId) {
    if (!serverToken) {
      const accountToken = await switchPlexHomeUser(cfg.clientId, cfg.adminToken!, user.plexManagedUserId);
      if (!accountToken) return { ok: false, reason: "switch failed via binding", code: "TOKEN_FAILED" };
      const st = await getPlexServerAccessToken(cfg.clientId, accountToken, machineIdentifier);
      if (!st) return { ok: false, reason: "no server access via binding", code: "NO_SERVER_ACCESS" };
      serverToken = st;
      updateUser(user.id, { plexServerToken: serverToken });
    }
    const valid = await validatePlexServerToken(cfg, serverToken);
    if (!valid) {
      updateUser(user.id, { plexServerToken: null });
      return { ok: false, reason: "token invalid via binding", code: "TOKEN_FAILED" };
    }
    const ctx: PlexUserContext = {
      movvizUserId: user.id,
      plexManagedUserId: user.plexManagedUserId,
      plexAccountId: user.plexId ?? undefined,
      machineIdentifier,
      serverToken,
      tokenFingerprint: fingerprintToken(serverToken),
      authSource: "managed",
      accountTokenSource: "HOME_SWITCH",
      bindingSource: binding.bindingSource,
      resolvedAt: Date.now(),
      localAccountId: binding.localAccountId,
      localAccountName: binding.localAccountName,
      historyAvailable: true,
    };
    return { ok: true, ctx };
  }
  if (user.plexId) {
    // Prefer the share's own accessToken (no personal login needed); cached token as fallback.
    if (!serverToken) {
      const shares = await getSharedServers(cfg.clientId, cfg.adminToken!, machineIdentifier).catch(() => null);
      serverToken = shares?.find((s) => s.userId === user.plexId)?.accessToken ?? null;
      if (!serverToken) return { ok: false, reason: "no share token via binding", code: "NO_SERVER_ACCESS" };
      updateUser(user.id, { plexServerToken: serverToken });
    }
    const valid = await validatePlexServerToken(cfg, serverToken);
    if (!valid) {
      updateUser(user.id, { plexServerToken: null });
      return { ok: false, reason: "token invalid via binding", code: "TOKEN_FAILED" };
    }
    const ctx: PlexUserContext = {
      movvizUserId: user.id,
      plexAccountId: user.plexId,
      machineIdentifier,
      serverToken,
      tokenFingerprint: fingerprintToken(serverToken),
      authSource: "shared",
      accountTokenSource: "SHARED",
      bindingSource: binding.bindingSource,
      resolvedAt: Date.now(),
      localAccountId: binding.localAccountId,
      localAccountName: binding.localAccountName,
      historyAvailable: true,
    };
    return { ok: true, ctx };
  }
  return { ok: false, reason: "binding unusable", code: "IDENTITY_UNRESOLVED" };
}

async function validatePlexServerToken(cfg: PlexServerConfig, token: string): Promise<boolean> {
  try {
    // Lightweight validation: try to fetch library sections with this token – if 401/403, invalid
    const { getLibrarySections } = await import("./client");
    // We use a timeout-wrapped fetch inside getLibrarySections which returns [] on failure, but we need to distinguish 401 vs empty
    // For now, we attempt a direct identity fetch with that token
    const { safePlexUrl } = await import("./safeUrl");
    const origin = safePlexUrl(cfg.hostname);
    const base = origin ? `${origin}:${cfg.port}` : `${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`;
    const res = await fetch(`${base}/identity`, { headers: { "x-plex-token": token, "x-plex-client-identifier": cfg.clientId }, cache: "no-store" });
    if (res.status === 401 || res.status === 403) return false;
    return res.ok;
  } catch {
    // Network error – assume token still potentially valid, don't invalidate aggressively
    return true;
  }
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

export async function diagnosePlexUser(movvizUserId: string): Promise<Record<string, unknown>> {
  const user = getUserById(movvizUserId);
  if (!user) return { movvizUserId, status: "USER_NOT_FOUND" };
  const cfg = loadPlexConfig();
  const base: Record<string, unknown> = {
    movvizUserId: user.id,
    username: user.username,
    plexId: user.plexId,
    plexManagedUserId: user.plexManagedUserId,
    plexTokenPresent: !!user.plexToken,
    plexServerTokenPresent: !!user.plexServerToken,
    role: user.role,
  };
  if (!cfg.hostname || !cfg.adminToken) return { ...base, status: "NOT_CONFIGURED" };
  const machineIdentifier = await ensureMachineIdentifier(cfg);
  base.machineIdentifier = machineIdentifier;
  const shares = machineIdentifier
    ? await getSharedServers(cfg.clientId, cfg.adminToken, machineIdentifier).catch(() => null)
    : null;
  const homeUsers = await getPlexHomeUsers(cfg.adminToken).catch(() => []);
  const localAccounts = await getLocalAccounts(cfg, cfg.adminToken).catch(() => []);
  base.sharedServersCount = shares?.length ?? -1; // -1 = endpoint unreachable
  base.sharedServersWithToken = shares?.filter((s) => !!s.accessToken).length ?? -1;
  base.plexHomeUsersCount = homeUsers.length;
  base.localAccounts = localAccounts.map((a) => ({ id: a.id, name: a.name }));
  const shareMatch = user.plexId ? shares?.find((s) => s.userId === user.plexId) ?? null : null;
  const homeMatch = user.plexManagedUserId ? homeUsers.find((h) => h.id === user.plexManagedUserId) ?? null : null;
  base.shareMatch = shareMatch
    ? { shareId: shareMatch.shareId, userId: shareMatch.userId, username: shareMatch.username, hasAccessToken: !!shareMatch.accessToken, accepted: shareMatch.accepted }
    : null;
  base.homeMatch = homeMatch ? { id: homeMatch.id, title: homeMatch.title } : null;
  const binding = machineIdentifier ? getBinding(user.id, machineIdentifier) : null;
  base.existingBinding = binding ?? null;
  const ctxRes = await resolvePlexUserContext(movvizUserId);
  if (ctxRes.ok) {
    base.resolveStatus = "RESOLVED";
    base.ctx = { ...ctxRes.ctx, serverToken: undefined, tokenFingerprint: ctxRes.ctx.tokenFingerprint };
  } else {
    base.resolveStatus = ctxRes.code;
    base.resolveReason = ctxRes.reason;
  }
  return base;
}

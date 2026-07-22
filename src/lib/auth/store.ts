import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import { randomBytes, createHmac } from "node:crypto";
import type { User } from "./types";
import { getRawSigningKey } from "./signing";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const USERS_FILE = path.join(CONFIG_DIR, "users.json");
const SESSIONS_FILE = path.join(CONFIG_DIR, "sessions.json");
const SIGNING_KEY_FILE = path.join(CONFIG_DIR, ".session-secret");

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hmacSign(token: string): string {
  const raw = getRawSigningKey();
  if (raw) return createHmac("sha256", raw).update(token).digest("hex");
  try {
    const key = fs.readFileSync(SIGNING_KEY_FILE, "utf-8").trim();
    if (key) return createHmac("sha256", key).update(token).digest("hex");
  } catch { /* fall through */ }
  const newKey = randomBytes(32).toString("hex");
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(SIGNING_KEY_FILE, newKey, "utf-8");
  return createHmac("sha256", newKey).update(token).digest("hex");
}

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

// ---- Users ----

export function loadUsers(): User[] {
  return readJson<User[]>(USERS_FILE, []);
}
function saveUsers(list: User[]) {
  writeJson(USERS_FILE, list);
}
export function hasAnyUser(): boolean {
  return loadUsers().length > 0;
}
export function getUserById(id: string): User | null {
  return loadUsers().find((u) => u.id === id) ?? null;
}
export function getUserByUsername(username: string): User | null {
  const norm = username.trim().toLowerCase();
  return loadUsers().find((u) => u.username.toLowerCase() === norm) ?? null;
}
export function getUserByPlexId(plexId: string): User | null {
  return loadUsers().find((u) => u.plexId === plexId) ?? null;
}
export function addUser(user: User): User {
  const list = loadUsers();
  list.push(user);
  saveUsers(list);
  return user;
}
export function updateUser(id: string, patch: Partial<User>): User | null {
  const list = loadUsers();
  const i = list.findIndex((u) => u.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  saveUsers(list);
  return list[i];
}
/** Used to reject a still-pending registration — never call on an already-approved account. */
export function deleteUser(id: string): boolean {
  const list = loadUsers();
  const next = list.filter((u) => u.id !== id);
  if (next.length === list.length) return false;
  saveUsers(next);
  return true;
}

// ---- Sessions ----

interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: number;
}

function loadSessions(): SessionRecord[] {
  return readJson<SessionRecord[]>(SESSIONS_FILE, []);
}
function saveSessions(list: SessionRecord[]) {
  writeJson(SESSIONS_FILE, list);
}

export function createSession(userId: string): { token: string; expiresAt: number } {
  const raw = randomBytes(32).toString("hex");
  const token = raw + "." + hmacSign(raw);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const list = loadSessions().filter((s) => s.expiresAt > Date.now());
  list.push({ token: raw, userId, expiresAt });
  saveSessions(list);
  return { token, expiresAt };
}

const HEX64 = /^[0-9a-f]{64}$/;

function isLegacyToken(s: string): boolean {
  return s.length === 64 && HEX64.test(s);
}

export function resolveSession(cookie: string | undefined | null): User | null {
  if (!cookie) return null;

  let raw: string | null = null;
  let sig: string | null = null;

  const dot = cookie.indexOf(".");
  if (dot > 0) {
    raw = cookie.slice(0, dot);
    sig = cookie.slice(dot + 1);
    if (!HEX64.test(raw) || !(sig.length === 64 && HEX64.test(sig))) raw = null;
  } else if (isLegacyToken(cookie)) {
    raw = cookie;
  }

  if (!raw) return null;

  const sessions = loadSessions();
  const session = sessions.find((s) => s.token === raw);
  if (!session || session.expiresAt < Date.now()) return null;
  if (sig && sig !== hmacSign(raw)) return null;
  return getUserById(session.userId);
}

export function destroySession(token: string | undefined | null) {
  if (!token) return;
  saveSessions(loadSessions().filter((s) => s.token !== token));
}

/** Drop every session past its expiry — real maintenance, run by the scheduler. */
export function purgeExpiredSessions(): number {
  const list = loadSessions();
  const alive = list.filter((s) => s.expiresAt > Date.now());
  saveSessions(alive);
  return list.length - alive.length;
}

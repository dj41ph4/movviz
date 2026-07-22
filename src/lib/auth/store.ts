import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { User } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const USERS_FILE = path.join(CONFIG_DIR, "users.json");
const SESSIONS_FILE = path.join(CONFIG_DIR, "sessions.json");

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const list = loadSessions().filter((s) => s.expiresAt > Date.now());
  list.push({ token, userId, expiresAt });
  saveSessions(list);
  return { token, expiresAt };
}

export function resolveSession(token: string | undefined | null): User | null {
  if (!token) return null;
  const session = loadSessions().find((s) => s.token === token);
  if (!session || session.expiresAt < Date.now()) return null;
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

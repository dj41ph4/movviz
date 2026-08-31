import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import type { ApiToken } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "tokens.json");

function readJson<T>(file: string, fallback: T): T {
  return readJsonCached(file, fallback);
}
function writeJson(file: string, data: unknown) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(file, data);
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export function loadTokens(userId: string): ApiToken[] {
  return readJson<ApiToken[]>(FILE, []).filter((t) => t.userId === userId);
}

/** Returns the plaintext token once — it is never stored or shown again. */
export function createToken(userId: string, name: string): { token: string; record: ApiToken } {
  const token = `mvz_${randomBytes(24).toString("hex")}`;
  const record: ApiToken = {
    id: `tk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    userId,
    name,
    tokenHash: hash(token),
    createdAt: Date.now(),
    lastUsedAt: null,
  };
  const all = readJson<ApiToken[]>(FILE, []);
  all.push(record);
  writeJson(FILE, all);
  return { token, record };
}

export function revokeToken(userId: string, id: string) {
  const all = readJson<ApiToken[]>(FILE, []);
  writeJson(FILE, all.filter((t) => !(t.id === id && t.userId === userId)));
}

/** Resolve a bearer token to the user id it belongs to, for external API calls. */
export function resolveTokenUserId(token: string | undefined | null): string | null {
  if (!token) return null;
  const all = readJson<ApiToken[]>(FILE, []);
  const match = all.find((t) => t.tokenHash === hash(token));
  if (!match) return null;
  match.lastUsedAt = Date.now();
  writeJson(FILE, all);
  return match.userId;
}

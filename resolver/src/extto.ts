import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { isChallengePage, type ResolverSession } from "./browser.js";
import { resolveChallenge } from "./solver.js";
import { useNamedSession } from "./sessions.js";

const BASE = "https://ext.to";
const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
type ExtToIndexer = { id: string; key?: string; enabled: boolean; apiKey: string; username: string; password: string };

function findIndexer(key: string, allowDisabled = false): ExtToIndexer | null {
  if (!key) return null;
  try {
    const indexers = JSON.parse(readFileSync(path.join(CONFIG_DIR, "indexers.json"), "utf8")) as ExtToIndexer[];
    return indexers.find((ix) => ix.key === "extto" && (allowDisabled || ix.enabled) && ix.apiKey === key) ?? null;
  } catch {
    return null;
  }
}

function sessionId(ix: ExtToIndexer): string {
  return `extto-${createHash("sha256").update(`${ix.id}\0${ix.username}\0${ix.password}`).digest("hex")}`;
}

async function loadPage(session: ResolverSession, url: string): Promise<string> {
  const result = await resolveChallenge(session, url, 120000, false, false);
  if (!result.success || result.status >= 400) throw new Error(`EXT.to page unavailable (HTTP ${result.status})`);
  return result.body;
}

async function ensureLogin(session: ResolverSession, ix: ExtToIndexer): Promise<void> {
  if (session.exttoAuthenticated) return;
  if (!ix.username || !ix.password) throw new Error("EXT.to login and password required");
  await loadPage(session, BASE);
  const page = session.page;
  // EXT.to opens its sign-in form through JavaScript, without a login URL.
  const loginLink = page.getByText(/^Log In$/i).first();
  if (!(await loginLink.count())) throw new Error("EXT.to login control not found");
  await loginLink.click();
  const password = page.locator('input[type="password"]').first();
  await password.waitFor({ state: "visible", timeout: 5000 });
  const username = page.locator('input[placeholder="Nickname"], input[name="username"], input[name="login"], input[autocomplete="username"]').first();
  if (!(await username.count())) throw new Error("EXT.to username field not found");
  await username.fill(ix.username);
  await password.fill(ix.password);
  const submit = page.getByRole("button", { name: /^Log In$/i }).last();
  if (!(await submit.count())) throw new Error("EXT.to login button not found");
  await submit.click();
  await password.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  await loginLink.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
  if (isChallengePage(await page.title()) || await password.isVisible().catch(() => false) || await page.getByText(/^Log In$/i).first().isVisible().catch(() => false)) {
    throw new Error("EXT.to login was not accepted");
  }
  session.exttoAuthenticated = true;
}

export interface ExtToItem {
  id: string;
  title: string;
  detailUrl: string;
  size: number;
  seeders: number;
  leechers: number;
  category: number;
}

function decodeHtml(value: string): string {
  return value.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function plain(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function sizeBytes(value: string): number {
  const match = value.replace(/,/g, ".").match(/([\d.]+)\s*(B|K|M|G|T)i?B?/i);
  if (!match) return 0;
  const unit = match[2].toUpperCase();
  return Math.floor(Number(match[1]) * 1024 ** Math.max(0, "BKMGT".indexOf(unit)));
}

export function parseExtToResults(html: string): ExtToItem[] {
  const table = html.match(/<table\b[^>]*class=["'][^"']*search-table[^"']*["'][^>]*>[\s\S]*?<\/table>/i)?.[0] ?? html;
  const items: ExtToItem[] = [];
  for (const row of table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
    const anchors = row.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
    const anchor = anchors.find((a) => /class=["'][^"']*torrent-title-link/i.test(a))
      ?? anchors.find((a) => /href=["']\/[a-z0-9-]+-\d+\/?["']/i.test(a));
    if (!anchor) continue;
    const href = decodeHtml(anchor.match(/href=["']([^"']+)["']/i)?.[1] ?? "");
    const url = new URL(href, BASE);
    if (url.origin !== BASE || !/^\/[a-z0-9-]+-(\d+)\/$/i.test(url.pathname)) continue;
    const id = url.pathname.match(/-(\d+)\/$/)?.[1];
    const title = plain(anchor).replace(/[._]/g, " ");
    if (!id || !title) continue;
    const cells = (row.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) ?? []).map(plain);
    const number = (value: string) => Number(value.match(/\d+/)?.[0] ?? 0);
    const category = /href=["']\/movies\//i.test(row) ? 2000
      : /href=["']\/anime\//i.test(row) ? 5070
      : /href=["']\/tv\//i.test(row) ? 5000 : 7000;
    items.push({ id, title, detailUrl: url.toString(), size: sizeBytes(cells[1] ?? ""), seeders: number(cells[4] ?? ""), leechers: number(cells[5] ?? ""), category });
  }
  return items;
}

function xml(value: string | number): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function feed(items: ExtToItem[]): string {
  const entries = items.map((item) => `<item><title>${xml(item.title)}</title><guid>extto-${item.id}</guid><link>${xml(item.detailUrl)}</link><size>${item.size}</size><enclosure url="${xml(item.detailUrl)}" length="${item.size}" type="application/x-bittorrent"/><torznab:attr name="category" value="${item.category}"/><torznab:attr name="seeders" value="${item.seeders}"/><torznab:attr name="peers" value="${item.seeders + item.leechers}"/></item>`).join("");
  return `<?xml version="1.0"?><rss version="2.0" xmlns:torznab="http://torznab.com/schemas/2015/feed"><channel><title>EXT.to</title>${entries}</channel></rss>`;
}

const CAPS = `<?xml version="1.0"?><caps><server title="EXT.to"/><searching><search available="yes" supportedParams="q"/><movie-search available="yes" supportedParams="q"/><tv-search available="yes" supportedParams="q,season,ep"/></searching><categories><category id="2000" name="Movies"/><category id="5000" name="TV"/><category id="5070" name="Anime"/></categories></caps>`;

async function magnetFor(session: ResolverSession, detailPath: string): Promise<string> {
  const html = await loadPage(session, `${BASE}${detailPath}`);
  const id = detailPath.match(/-(\d+)\/$/)?.[1];
  const pageToken = html.match(/window\.pageToken\s*=\s*['"]([^'"]+)['"]/)?.[1];
  const csrf = html.match(/window\.csrfToken\s*=\s*['"]([^'"]+)['"]/)?.[1];
  if (!id || !pageToken || !csrf) throw new Error("EXT.to magnet tokens missing");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = new URLSearchParams({ torrent_id: id, action: "get_magnet", timestamp, hmac: createHash("sha256").update(`${id}|${timestamp}|${pageToken}`).digest("hex"), sessid: csrf });
  const response = await session.context.request.post(`${BASE}/ajax/getTorrentMagnet.php`, {
    data: body.toString(),
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-requested-with": "XMLHttpRequest", referer: `${BASE}${detailPath}`, origin: BASE, "user-agent": await session.page.evaluate(() => navigator.userAgent) },
    timeout: 30000,
  });
  if (!response.ok()) throw new Error(`EXT.to magnet HTTP ${response.status()}`);
  const raw = await response.text();
  const parsed = JSON.parse(raw.match(/<pre>([\s\S]*?)<\/pre>/i)?.[1] ?? raw) as { success?: boolean; magnet?: string; error?: string };
  if (!parsed.success || !parsed.magnet?.startsWith("magnet:?")) throw new Error(parsed.error ?? "EXT.to magnet unavailable");
  return parsed.magnet;
}

export async function registerExtToRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { username?: string; password?: string } }>("/extto/test", async (req, reply) => {
    const ix = findIndexer(String(req.headers["x-api-key"] ?? ""), true);
    if (!ix) return reply.status(403).send({ ok: false, detail: "EXT.to indexer not found" });
    const draft = { ...ix, username: req.body?.username?.trim() || ix.username, password: req.body?.password || ix.password };
    if (!draft.username || !draft.password) return reply.status(400).send({ ok: false, detail: "EXT.to login and password required" });
    try {
      await useNamedSession(sessionId(draft), async (session) => {
        await ensureLogin(session, draft);
        await loadPage(session, `${BASE}/browse/?q=test&with_adult=1`);
        if (await session.page.getByText(/^Log In$/i).first().isVisible().catch(() => false)) {
          session.exttoAuthenticated = false;
          throw new Error("EXT.to session did not stay signed in");
        }
      });
      return { ok: true, detail: "EXT.to login and search OK" };
    } catch (err) {
      req.log.warn({ err }, "EXT.to connection test failed");
      return reply.status(502).send({ ok: false, detail: err instanceof Error ? err.message : "EXT.to unavailable" });
    }
  });

  app.get<{ Querystring: { apikey?: string; t?: string; q?: string; offset?: string; season?: string; ep?: string } }>("/extto/api", async (req, reply) => {
    const ix = findIndexer(String(req.headers["x-api-key"] ?? ""));
    if (!ix) return reply.status(403).send({ error: "forbidden" });
    if (req.query.t === "caps") return reply.type("application/xml").send(CAPS);
    if (!new Set(["search", "movie", "tvsearch"]).has(req.query.t ?? "search")) return reply.status(400).send({ error: "unsupported search" });
    const q = String(req.query.q ?? "").replace(/[._]/g, " ").trim().slice(0, 150);
    const search = req.query.t === "tvsearch" && req.query.season ? `${q} S${req.query.season}${req.query.ep ? `E${req.query.ep}` : ""}` : q;
    try {
    const html = await useNamedSession(sessionId(ix), async (session) => {
        await ensureLogin(session, ix);
        const target = `${BASE}/browse/?q=${encodeURIComponent(search)}&with_adult=1${req.query.offset ? `&page=${Math.floor(Number(req.query.offset) / 50) + 1}` : ""}`;
        let result = await loadPage(session, target);
        if (await session.page.getByText(/^Log In$/i).first().isVisible().catch(() => false)) {
          session.exttoAuthenticated = false;
          await ensureLogin(session, ix);
          result = await loadPage(session, target);
        }
        return result;
      });
      const categories = new Set(String((req.query as typeof req.query & { cat?: string }).cat ?? "").split(",").map(Number).filter((value) => value > 0));
      const items = parseExtToResults(html).filter((item) => !categories.size || categories.has(item.category) || (item.category === 5070 && categories.has(5000)));
      return reply.type("application/rss+xml").send(feed(items));
    } catch (err) {
      req.log.warn({ err }, "EXT.to search failed");
      return reply.status(502).send({ error: err instanceof Error ? err.message : "EXT.to unavailable" });
    }
  });

  app.get<{ Querystring: { apikey?: string; path?: string } }>("/extto/magnet", async (req, reply) => {
    const ix = findIndexer(String(req.headers["x-api-key"] ?? ""));
    if (!ix) return reply.status(403).send({ error: "forbidden" });
    const detailPath = req.query.path ?? "";
    if (!/^\/[a-z0-9-]+-\d+\/$/i.test(detailPath)) return reply.status(400).send({ error: "invalid path" });
    try {
      const magnet = await useNamedSession(sessionId(ix), async (session) => {
        await ensureLogin(session, ix);
        return magnetFor(session, detailPath);
      });
      return { magnet };
    } catch (err) {
      req.log.warn({ err }, "EXT.to magnet failed");
      return reply.status(502).send({ error: err instanceof Error ? err.message : "EXT.to magnet unavailable" });
    }
  });
}

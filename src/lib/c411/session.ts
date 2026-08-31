import { loadIndexers } from "@/lib/indexers/store";
import { safeC411Origin, c411OriginFromBaseUrl } from "./safeUrl";

/** Browser-like UA so the tracker's anti-bot stack doesn't 403 the page fetch that carries the CSRF token. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * C411 site-session client — powers the Discover lists (homepage rows + today's
 * uploads). C411 exposes no RSS for those lists; they only exist behind the
 * web session obtained from POST /api/auth/login (the JSON login used by the
 * site's own UI, which does not go through the Cloudflare Turnstile wall that
 * guards the HTML login form).
 *
 * Anchored on globalThis because Next.js bundles each API route separately —
 * a module-level session cache would exist once per bundle.
 */

export interface C411ListsConfig {
  origin: string;
  username: string;
  password: string;
}

/** The configured C411 indexer is the one whose base URL points at c411.org. */
export function loadC411ListsConfig(): C411ListsConfig | null {
  const ix = loadIndexers().find(
    (i) =>
      i.listsEnabled === true &&
      !!i.username &&
      !!i.password &&
      i.baseUrl.toLowerCase().includes("c411.org")
  );
  if (!ix) return null;
  const origin = c411OriginFromBaseUrl(ix.baseUrl);
  if (!origin) return null;
  return { origin, username: ix.username, password: ix.password };
}

interface SessionState {
  cookie: string;
  at: number;
}

const g = globalThis as typeof globalThis & {
  __movvizC411Session?: SessionState;
  __movvizC411LoginInFlight?: Promise<string>;
  __movvizC411LastFetchAt?: number;
};

/** Re-login on 401s and when the cached cookie is older than this. */
const SESSION_TTL_MS = 25 * 60 * 1000;
/** Gentle pacing so the tracker never sees bursts from row refreshes. */
const MIN_GAP_MS = 350;

function lastFetchAt(): number {
  return g.__movvizC411LastFetchAt ?? 0;
}

async function pace() {
  const gap = Date.now() - lastFetchAt();
  if (gap < MIN_GAP_MS) await new Promise((r) => setTimeout(r, MIN_GAP_MS - gap));
}

async function login(cfg: C411ListsConfig): Promise<string> {
  // C411's JSON API is CSRF-protected: the login must carry the token from the
  // page's <meta name="csrf-token"> tag together with the __csrf cookie the
  // page set. Both come from the site root — one extra cheap request per login.
  const page = await fetch(cfg.origin + "/", {
    headers: { "user-agent": UA },
    cache: "no-store",
  });
  const html = await page.text();
  const token = html.match(/name="csrf-token" content="([^"]+)"/)?.[1] ?? "";
  const pageCookies = page.headers.get("set-cookie") ?? "";
  const csrfCookie = pageCookies.match(/__csrf=([^;]+)/)?.[0] ?? "";

  const res = await fetch(`${cfg.origin}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": UA,
      origin: cfg.origin,
      referer: cfg.origin + "/",
      "csrf-token": token,
      cookie: csrfCookie,
    },
    body: JSON.stringify({ username: cfg.username, password: cfg.password }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`c411 login failed: HTTP ${res.status}`);
  const raw = res.headers.get("set-cookie") ?? "";
  // The session cookie is __Host-c411_session=… — take the last *_session cookie present.
  const m = [...raw.matchAll(/(?:^|,\s*)([^=;,\s]*_session)=([^;]+)/gi)];
  if (m.length === 0) throw new Error("c411 login: no session cookie returned");
  const cookie = m[m.length - 1][1] + "=" + m[m.length - 1][2];
  const body = (await res.json().catch(() => null)) as { success?: boolean } | null;
  if (!body || body.success !== true) throw new Error("c411 login: rejected credentials");
  g.__movvizC411Session = { cookie, at: Date.now() };
  return cookie;
}

/**
 * Live login probe for the settings screen — performs the real site login with
 * the currently stored credentials and reports whether it succeeded. Also
 * warms the shared session cache so the next list fetch starts already logged in.
 */
export async function probeC411Login(cfg: C411ListsConfig): Promise<{ ok: boolean; detail: string }> {
  try {
    await login(cfg);
    return { ok: true, detail: "login ok" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

function freshSession(): SessionState | null {
  const s = g.__movvizC411Session;
  if (!s || Date.now() - s.at > SESSION_TTL_MS) return null;
  return s;
}

function getCookie(cfg: C411ListsConfig): Promise<string> {
  const s = freshSession();
  if (s) return Promise.resolve(s.cookie);
  if (g.__movvizC411LoginInFlight) return g.__movvizC411LoginInFlight;
  g.__movvizC411LoginInFlight = login(cfg).finally(() => {
    g.__movvizC411LoginInFlight = undefined;
  });
  return g.__movvizC411LoginInFlight;
}

/**
 * Authenticated GET to a C411 API path (e.g. `/api/homepage`). Validates the
 * derived URL (SSRF), paces requests, and transparently re-logs in once when
 * the session has expired (HTTP 401). Returns parsed JSON.
 */
export async function c411FetchJson(cfg: C411ListsConfig, path: string): Promise<any> {
  const origin = safeC411Origin(cfg.origin);
  if (!origin) throw new Error("c411: invalid origin");
  const url = origin + path;
  if (!path.startsWith("/")) throw new Error("c411: invalid path");

  const doFetch = async (): Promise<any> => {
    await pace();
    g.__movvizC411LastFetchAt = Date.now();
    const cookie = await getCookie(cfg);
    const res = await fetch(url, {
      headers: { cookie, "user-agent": UA, accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 401) return null; // signal retry below
    if (!res.ok) throw new Error(`c411 ${path}: HTTP ${res.status}`);
    return await res.json();
  };

  let data = await doFetch();
  if (data === null) {
    g.__movvizC411Session = undefined; // stale cookie — force re-login
    data = await doFetch();
  }
  if (data === null) throw new Error(`c411 ${path}: HTTP 401 after re-login`);
  return data;
}

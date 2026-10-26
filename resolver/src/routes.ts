import type { FastifyInstance } from "fastify";
import { createSession, closeSession, shutdown as shutdownBrowser } from "./browser.js";
import { resolveChallenge } from "./solver.js";
import { createNamedSession, destroyNamedSession, destroyAllSessions, useNamedSession } from "./sessions.js";
import { registerExtToRoutes } from "./extto.js";

interface V1Request {
  cmd?: string;
  url?: string;
  session?: string;
  maxTimeout?: number;
  returnOnlyCookies?: boolean;
  blockMedia?: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}

interface V1Response {
  status: string;
  message: string;
  solution: {
    url: string;
    status: number;
    cookies: {
      name: string;
      value: string;
      domain: string;
      path: string;
      httpOnly: boolean;
      secure: boolean;
      sameSite: string;
    }[];
    userAgent: string;
    response: string;
    contentType: string;
    headers: Record<string, string>;
  };
  startTimestamp: number;
  endTimestamp: number;
  version: string;
}

const VERSION = "0.2.0";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerExtToRoutes(app);
  app.get("/", async (_req, reply) => {
    return reply.redirect("/docs");
  });

  app.get("/health", async () => {
    return { status: "ok", version: VERSION };
  });

  app.post<{ Body: V1Request }>("/v1", async (req, reply) => {
    const startTimestamp = Date.now();
    const { cmd, url, session: sessionId, returnOnlyCookies = false, blockMedia = false, proxy } = req.body ?? {};

    if (cmd === "sessions.create") {
      try {
        const id = await createNamedSession(sessionId, proxy);
        return { status: "ok", message: "Session created successfully.", session: id, startTimestamp, endTimestamp: Date.now(), version: VERSION };
      } catch (err) {
        return reply.status(500).send({ status: "error", message: String(err), startTimestamp, endTimestamp: Date.now(), version: VERSION });
      }
    }

    if (cmd === "sessions.destroy") {
      if (!sessionId) return reply.status(400).send({ status: "error", message: "Missing required field: session", startTimestamp, endTimestamp: Date.now(), version: VERSION });
      const removed = await destroyNamedSession(sessionId);
      if (!removed) return reply.status(404).send({ status: "error", message: "The session doesn't exist.", startTimestamp, endTimestamp: Date.now(), version: VERSION });
      return { status: "ok", message: "The session has been removed.", startTimestamp, endTimestamp: Date.now(), version: VERSION };
    }

    if (cmd && cmd !== "request.get") {
      return reply.status(400).send({ status: "error", message: `Unsupported command: ${cmd}`, startTimestamp, endTimestamp: Date.now(), version: VERSION });
    }

    // Requests without cmd retain Movviz's original seconds-based contract.
    const rawTimeout = req.body?.maxTimeout ?? (cmd ? 60000 : 60);
    const timeoutMs = cmd ? rawTimeout : rawTimeout * 1000;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) {
      return reply.status(400).send({ status: "error", message: "Invalid maxTimeout", startTimestamp, endTimestamp: Date.now(), version: VERSION });
    }

    if (!url) {
      return reply.status(400).send({
        status: "error",
        message: "Missing required field: url",
        solution: { url: "", status: 400, cookies: [], userAgent: "", response: "", contentType: "text/plain", headers: {} },
        startTimestamp,
        endTimestamp: Date.now(),
        version: VERSION,
      } satisfies V1Response);
    }

    let temporarySession;
    try {
      const solve = async (browserSession: Awaited<ReturnType<typeof createSession>>) =>
        resolveChallenge(browserSession, url, timeoutMs, returnOnlyCookies, blockMedia);
      let result;
      if (cmd === "request.get" && sessionId) {
        result = await useNamedSession(sessionId, solve);
      } else {
        temporarySession = await createSession(proxy);
        result = await solve(temporarySession);
      }

      if (!result.success) {
        return reply.status(408).send({
          status: "error",
          message: `Timeout or error resolving challenge: ${result.body}`,
          solution: {
            url: result.url,
            status: result.status,
            cookies: result.cookies,
            userAgent: result.userAgent,
            response: result.body,
            contentType: result.contentType,
            headers: result.headers,
          },
          startTimestamp,
          endTimestamp: Date.now(),
          version: VERSION,
        } satisfies V1Response);
      }

      return {
        status: "ok",
        message: "Success",
        solution: {
          url: result.url,
          status: result.status,
          cookies: result.cookies,
          userAgent: result.userAgent,
          response: result.body,
          contentType: result.contentType,
          headers: result.headers,
        },
        startTimestamp,
        endTimestamp: Date.now(),
        version: VERSION,
      } satisfies V1Response;
    } catch (err) {
      return reply.status(500).send({ status: "error", message: err instanceof Error ? err.message : String(err), startTimestamp, endTimestamp: Date.now(), version: VERSION });
    } finally {
      if (temporarySession) await closeSession(temporarySession);
    }
  });

  app.get("/docs", async () => {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Movviz Resolver</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow-x:auto}code{background:#f4f4f4;padding:2px 5px;border-radius:3px}</style></head>
<body><h1>Movviz Resolver</h1><p>Cloudflare challenge resolver for indexers.</p>
<h2>POST /v1</h2><h3>Request body:</h3>
<pre>{
  "url": "https://example-indexer.org",
  "maxTimeout": 60,
  "returnOnlyCookies": false,
  "blockMedia": false,
  "proxy": { "server": "http://proxy:8080", "username": "", "password": "" }
}</pre>
<p>Existing requests without <code>cmd</code> use maxTimeout in seconds. FlareSolverr-compatible requests use milliseconds:</p>
<pre>{"cmd":"sessions.create","session":"extto_persistent"}</pre>
<pre>{"cmd":"request.get","url":"https://ext.to/","session":"extto_persistent","maxTimeout":120000}</pre>
<pre>{"cmd":"sessions.destroy","session":"extto_persistent"}</pre>
<p>Named sessions retain cookies for up to 60 minutes of inactivity. At most 10 named sessions are allowed.</p>
<h3>Response:</h3>
<pre>{
  "status": "ok",
  "message": "Success",
  "solution": {
    "url": "https://...",
    "status": 200,
    "cookies": [{"name":"cf_clearance","value":"...","domain":".example.org","path":"/","httpOnly":true,"secure":true,"sameSite":"lax"}],
    "userAgent": "Mozilla/5.0 ...",
    "response": "...",
    "contentType": "text/html",
    "headers": {}
  },
  "startTimestamp": ...,
  "endTimestamp": ...,
  "version": "0.2.0"
}</pre>
<h3>GET /health</h3><pre>{"status":"ok","version":"0.2.0"}</pre></body></html>`;
  });
}

export async function shutdown(): Promise<void> {
  await destroyAllSessions();
  await shutdownBrowser();
}

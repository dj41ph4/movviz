import type { FastifyInstance } from "fastify";
import { createSession, closeSession, shutdown } from "./browser.js";
import { resolveChallenge } from "./solver.js";

interface V1Request {
  cmd?: string;
  url?: string;
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

const VERSION = "0.1.0";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (_req, reply) => {
    return reply.redirect("/docs");
  });

  app.get("/health", async () => {
    return { status: "ok", version: VERSION };
  });

  app.post<{ Body: V1Request }>("/v1", async (req, reply) => {
    const startTimestamp = Date.now();
    const { url, maxTimeout = 60, returnOnlyCookies = false, blockMedia = false, proxy } = req.body;

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

    let session;
    try {
      session = await createSession(proxy);
      const result = await resolveChallenge(session, url, maxTimeout, returnOnlyCookies, blockMedia);

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
    } finally {
      if (session) await closeSession(session);
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
  "version": "0.1.0"
}</pre>
<h3>GET /health</h3><pre>{"status":"ok","version":"0.1.0"}</pre></body></html>`;
  });
}

export { shutdown };

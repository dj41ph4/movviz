import http from "node:http";
import { ENGINE_PORT, ENGINE_HOST, ENGINE_TOKEN, HOSTNAME } from "./config.mjs";
import { getLogs } from "./logger.mjs";

/**
 * Minimal JSON REST API over Node's built-in http — no framework, all original.
 * Bound to loopback; the Movviz web app proxies to it, so browsers never reach
 * the engine directly. An optional shared token adds defense in depth.
 */

const started = Date.now();

function send(res, status, body) {
  const json = JSON.stringify(body ?? {});
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

export function createApiServer(engine) {
  const server = http.createServer(async (req, res) => {
    try {
      if (ENGINE_TOKEN && req.headers["x-movviz-token"] !== ENGINE_TOKEN) {
        return send(res, 401, { error: "unauthorized" });
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const parts = url.pathname.split("/").filter(Boolean);
      const method = req.method;

      // GET /health
      if (method === "GET" && parts[0] === "health") {
        const cpu = process.cpuUsage();
        return send(res, 200, {
          status: "ok",
          hostname: HOSTNAME,
          uptimeMs: Date.now() - started,
          started: engine.started,
          // Resource footprint, so the Diagnostics panel can show which
          // process (web vs engine) is actually eating the machine.
          rssBytes: process.memoryUsage().rss,
          cpuMs: Math.round((cpu.user + cpu.system) / 1000),
        });
      }

      // GET /stats
      if (method === "GET" && parts[0] === "stats") {
        return send(res, 200, engine.stats());
      }

      // GET /logs — recent engine console output, for diagnosing issues without shell access to the host.
      if (method === "GET" && parts[0] === "logs") {
        return send(res, 200, { logs: getLogs() });
      }

      // /instances
      if (parts[0] === "instances") {
        if (method === "GET" && parts.length === 1) {
          return send(res, 200, { instances: engine.instancesInfo() });
        }
        if (method === "PATCH" && parts[1]) {
          const patch = await readBody(req);
          const cfg = engine.patchInstance(parts[1], patch);
          return cfg ? send(res, 200, cfg) : send(res, 404, { error: "no such instance" });
        }
      }

      // /torrents
      if (parts[0] === "torrents") {
        if (method === "GET" && parts.length === 1) {
          return send(res, 200, { torrents: engine.listTorrents() });
        }
        if (method === "POST" && parts[1] === "clear-finished") {
          const cleared = await engine.clearFinished();
          return send(res, 200, { cleared });
        }
        if (method === "POST" && parts.length === 1) {
          const body = await readBody(req);
          // A .torrent file arrives base64-encoded; decode to a Buffer that
          // WebTorrent parses directly. Otherwise it's a magnet/URL/infohash.
          const torrentId = body.torrentFile
            ? Buffer.from(body.torrentFile, "base64")
            : body.torrentId ?? body.magnetURI ?? body.magnet;
          try {
            const t = await engine.add({
              torrentId,
              category: body.category,
              instanceId: body.instanceId,
              sequential: body.sequential,
              paused: body.paused,
              libraryRef: body.libraryRef,
              title: body.title,
              year: body.year,
              episodeTarget: body.episodeTarget,
              episodeTargets: body.episodeTargets,
            });
            return send(res, 201, t);
          } catch (e) {
            return send(res, 400, { error: e.message });
          }
        }
        const infoHash = parts[1];
        if (infoHash) {
          if (method === "GET" && parts.length === 2) {
            const d = engine.detail(infoHash);
            return d ? send(res, 200, d) : send(res, 404, { error: "not found" });
          }
          if (method === "DELETE") {
            const deleteData = url.searchParams.get("deleteData") === "1" ||
              url.searchParams.get("deleteData") === "true";
            const ok = await engine.remove(infoHash, deleteData);
            return send(res, ok ? 200 : 404, { removed: ok });
          }
          if (method === "POST" && parts[2] === "pause") {
            return send(res, 200, { ok: engine.pause(infoHash) });
          }
          if (method === "POST" && parts[2] === "resume") {
            return send(res, 200, { ok: engine.resume(infoHash) });
          }
          if (method === "POST" && parts[2] === "restart") {
            return send(res, 200, { ok: await engine.restart(infoHash) });
          }
          if (method === "POST" && parts[2] === "sequential") {
            const body = await readBody(req);
            return send(res, 200, { ok: engine.setSequential(infoHash, body.on ?? true) });
          }
          if (method === "POST" && parts[2] === "files") {
            const body = await readBody(req);
            return send(res, 200, { ok: engine.setFilePriorities(infoHash, body.priorities ?? []) });
          }
        }
      }

      send(res, 404, { error: "not found" });
    } catch (e) {
      console.error("[engine:api] error:", e);
      send(res, 500, { error: "internal error" });
    }
  });

  return {
    listen: () =>
      new Promise((resolve) => server.listen(ENGINE_PORT, ENGINE_HOST, resolve)),
    close: () => new Promise((resolve) => server.close(resolve)),
    server,
  };
}

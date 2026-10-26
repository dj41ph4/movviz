import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { registerRoutes, shutdown } from "../dist/routes.js";
import { parseExtToResults } from "../dist/extto.js";

const app = Fastify();
const target = createServer((req, res) => {
  const hasCookie = req.headers.cookie?.includes("resolver_test=present") ?? false;
  res.setHeader("content-type", "text/html");
  if (req.url === "/challenge") {
    res.end("<title>Just a moment...</title><form id='challenge-form'></form>");
    return;
  }
  if (req.url === "/cookie") res.setHeader("set-cookie", "resolver_test=present; Path=/");
  res.end(`<title>Ready</title><p>${hasCookie ? "cookie-present" : "cookie-absent"}</p>`);
});

let base;
before(async () => {
  await registerRoutes(app);
  await new Promise((resolve) => target.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${target.address().port}`;
});
after(async () => {
  await app.close();
  await shutdown();
  await new Promise((resolve) => target.close(resolve));
});

const post = (body) => app.inject({ method: "POST", url: "/v1", payload: body });

test("old Movviz request remains valid with seconds-based timeout", async () => {
  const response = await post({ url: `${base}/cookie`, maxTimeout: 5, returnOnlyCookies: true });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().status, "ok");
  assert.equal(response.json().solution.response, "");
  assert.ok(response.json().solution.cookies.some((cookie) => cookie.name === "resolver_test"));
});

test("FlareSolverr named session retains cookies and can be destroyed", async () => {
  const created = await post({ cmd: "sessions.create", session: "extto_test" });
  assert.equal(created.json().session, "extto_test");
  const first = await post({ cmd: "request.get", url: `${base}/cookie`, session: "extto_test", maxTimeout: 5000 });
  assert.equal(first.statusCode, 200, first.body);
  const second = await post({ cmd: "request.get", url: `${base}/check`, session: "extto_test", maxTimeout: 5000 });
  assert.equal(second.statusCode, 200, second.body);
  assert.match(second.json().solution.response, /cookie-present/);
  const removed = await post({ cmd: "sessions.destroy", session: "extto_test" });
  assert.equal(removed.json().status, "ok");
  const missing = await post({ cmd: "sessions.destroy", session: "extto_test" });
  assert.equal(missing.json().status, "error");
});

test("unresolved challenge is reported as an error", async () => {
  const response = await post({ cmd: "request.get", url: `${base}/challenge`, maxTimeout: 2500 });
  assert.equal(response.json().status, "error");
});

test("rejects invalid commands, missing URL and invalid timeout", async () => {
  assert.equal((await post({ cmd: "unknown" })).statusCode, 400);
  assert.equal((await post({ cmd: "request.get" })).statusCode, 400);
  assert.equal((await post({ cmd: "request.get", url: base, maxTimeout: 0 })).statusCode, 400);
});

test("integrated EXT.to API rejects requests without its private key", async () => {
  const response = await app.inject({ method: "GET", url: "/extto/api?t=caps" });
  assert.equal(response.statusCode, 403);
});

test("EXT.to search rows retain detail URL, size, seeds and category", () => {
  const html = `<table class="search-table"><tr>
    <td><a href="/movies/">Movies</a><a class="torrent-title-link" href="/sample-release-12345/">Sample.Release.2026.1080p</a></td>
    <td>1.5 GB</td><td>1</td><td>2 days ago</td><td>42</td><td>3</td>
  </tr></table>`;
  assert.deepEqual(parseExtToResults(html), [{
    id: "12345", title: "Sample Release 2026 1080p", detailUrl: "https://ext.to/sample-release-12345/",
    size: Math.floor(1.5 * 1024 ** 3), seeders: 42, leechers: 3, category: 2000,
  }]);
});

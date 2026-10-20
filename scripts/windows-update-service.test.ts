import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { NextRequest } from "next/server";
import { queueWindowsUpdate, readWindowsUpdateProgress } from "../src/lib/updates/windowsUpdateService";

test("update requests are complete, exclusive and contain only the target version", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-update-queue-"));
  try {
    fs.writeFileSync(path.join(directory, "heartbeat"), "alive");
    queueWindowsUpdate("1.27.07", directory);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, "request.json"), "utf8")), { version: "1.27.07" });
    assert.throws(() => queueWindowsUpdate("1.27.08", directory), /already_running/);
    assert.throws(() => queueWindowsUpdate("../evil", directory), /invalid_version/);
    assert.equal(fs.readdirSync(directory).filter((name) => name.endsWith(".tmp")).length, 0);
    fs.renameSync(path.join(directory, "request.json"), path.join(directory, "active.json"));
    assert.throws(() => queueWindowsUpdate("1.27.08", directory), /already_running/);
    fs.unlinkSync(path.join(directory, "active.json"));
    fs.rmdirSync(path.join(directory, "pending"));
    fs.utimesSync(path.join(directory, "heartbeat"), new Date(0), new Date(0));
    assert.throws(() => queueWindowsUpdate("1.27.08", directory), /unavailable/);
    assert.deepEqual(readWindowsUpdateProgress(directory), { status: "idle" });
    fs.writeFileSync(path.join(directory, "status.json"), '\uFEFF{"status":"error","error":"checksum mismatch"}');
    assert.equal(readWindowsUpdateProgress(directory).error, "checksum mismatch");
  } finally {
    for (const file of fs.readdirSync(directory, { withFileTypes: true })) {
      if (file.isDirectory()) fs.rmdirSync(path.join(directory, file.name));
      else fs.unlinkSync(path.join(directory, file.name));
    }
    fs.rmdirSync(directory);
  }
});

test("server refuses disabled automatic updates but accepts an explicit manual click", async () => {
  let queued = 0;
  let admin = true;
  const realRequire = createRequire(import.meta.url);
  const source = fs.readFileSync(new URL("../src/app/api/system/update/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module = { exports: {} as { POST: (req: NextRequest) => Promise<Response> } };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, process: { platform: "win32", cwd: () => "fixture" },
    require: (name: string) => {
      if (name === "node:fs") return { readFileSync: () => '{"version":"1.27.06"}' };
      if (name === "@/lib/auth/guard") return { requireAdmin: () => admin ? { id: "admin", role: "admin" } : null };
      if (name === "@/lib/settings/autoUpdate") return { isAutoUpdateEnabled: () => false };
      if (name === "@/lib/updates/windowsUpdateService") return { queueWindowsUpdate: () => { queued++; }, readWindowsUpdateProgress: () => ({ status: "idle" }) };
      return realRequire(name);
    },
    fetch: async () => Response.json({ tag_name: "v1.27.07", assets: [{ name: "Movviz-Setup-1.27.07.exe" }] }),
  });
  const request = (automatic: boolean) => new NextRequest("http://localhost/api/system/update", { method: "POST", body: JSON.stringify({ automatic }) });
  assert.equal((await module.exports.POST(request(true))).status, 409);
  assert.equal(queued, 0);
  assert.equal((await module.exports.POST(request(false))).status, 202);
  assert.equal(queued, 1);
  admin = false;
  assert.equal((await module.exports.POST(request(false))).status, 403);
  assert.equal(queued, 1);
});

test("client waits for completed installation and exact running version, and reports worker errors", async () => {
  const source = fs.readFileSync(new URL("../src/lib/updates/installSystemUpdate.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  for (const failing of [false, true]) {
    let reloads = 0;
    let polls = 0;
    let healthChecks = 0;
    const module = { exports: {} as { installSystemUpdate: (automatic?: boolean) => Promise<void> } };
    vm.runInNewContext(compiled, {
      module, exports: module.exports, AbortSignal,
      setTimeout: (callback: () => void) => callback(),
      window: { location: { reload: () => { reloads++; } } },
      fetch: async (url: string, options: RequestInit) => {
        if (url === "/api/system/update") {
          assert.deepEqual(JSON.parse(options.body as string), { automatic: true });
          return Response.json({ accepted: true, version: "1.27.07" }, { status: 202 });
        }
        if (url.includes("progress")) {
          polls++;
          if (failing) return Response.json({ status: "error", version: "1.27.07", error: "SHA256 mismatch", updatedAt: new Date().toISOString() });
          assert.equal(reloads, 0);
          return Response.json({ status: polls === 1 ? "installing" : "complete", version: "1.27.07" });
        }
        healthChecks++;
        return Response.json({ ok: true, version: healthChecks === 1 ? "1.27.06" : "1.27.07" });
      },
    });
    if (failing) {
      await assert.rejects(module.exports.installSystemUpdate(true), /SHA256 mismatch/);
      assert.equal(reloads, 0);
    } else {
      await module.exports.installSystemUpdate(true);
      assert.equal(reloads, 1);
      assert.equal(healthChecks, 2);
      assert.equal(polls, 3);
    }
  }
});

test("saved automatic-update preference must load before any automatic trigger", () => {
  const source = fs.readFileSync(new URL("../src/lib/settings/useAutoUpdate.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  for (const data of [undefined, { enabled: false }, { enabled: true }]) {
    const module = { exports: {} as { useAutoUpdate: () => { enabled: boolean } } };
    vm.runInNewContext(compiled, { module, exports: module.exports, require: () => () => ({ data }) });
    assert.equal(module.exports.useAutoUpdate().enabled, data?.enabled === true);
  }
});

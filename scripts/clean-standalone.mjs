#!/usr/bin/env node
// Cleans the Next.js standalone output: the file tracer can pull whole
// workspace directories (.movviz-data, data, dta, engine, ...) into
// .next/standalone when fs calls use process.cwd()-joined dynamic paths.
// Those folders are dev-only (or re-staged by packaging\windows\installer
// build.ps1) and must never ship inside the standalone bundle.
//
// Safety (see AGENTS.md "File deletion safety"):
//  - only operates inside <projectRoot>/.next/standalone
//  - whitelist keeps only what server.js needs at runtime
//  - path is resolved + prefix-checked before any recursive delete

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.log(`clean-standalone: nothing to do (${standalone} missing)`);
  process.exit(0);
}

const resolvedStandalone = path.resolve(standalone);
const keep = new Set([".next", "node_modules", "server.js", "package.json"]);
const workersSource = path.join(root, "src", "lib", "workers");
const workersDestination = path.join(resolvedStandalone, "workers");

let removed = 0;
for (const entry of fs.readdirSync(resolvedStandalone)) {
  if (keep.has(entry)) continue;

  const target = path.join(resolvedStandalone, entry);
  if (!target.startsWith(resolvedStandalone + path.sep)) {
    throw new Error(`clean-standalone: refusing to delete outside standalone: ${target}`);
  }
  if (path.dirname(target) !== resolvedStandalone) {
    throw new Error(`clean-standalone: refusing to delete nested path: ${target}`);
  }

  fs.rmSync(target, { recursive: true, force: true });
  removed += 1;
}

// Worker threads are loaded dynamically and are therefore invisible to
// Next's output tracer. Copy every plain-JS worker explicitly after cleanup;
// resolveWorkerUrl() selects these files in the standalone runtime.
const workerFiles = fs.readdirSync(workersSource).filter((file) => file.endsWith("Worker.mjs"));
if (workerFiles.length === 0) throw new Error("clean-standalone: no worker assets found");
fs.mkdirSync(workersDestination, { recursive: true });
for (const file of workerFiles) {
  fs.copyFileSync(path.join(workersSource, file), path.join(workersDestination, file));
}

console.log(`clean-standalone: removed ${removed} entry(ies); staged ${workerFiles.length} worker asset(s)`);

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { recordResolverOutput } from "./logCapture";
import { loadIndexers } from "@/lib/indexers/store";

const HOST = process.env.MOVVIZ_RESOLVER_HOST ?? "127.0.0.1";
const PORT = process.env.MOVVIZ_RESOLVER_PORT ?? "9830";
const BASE = `http://${HOST}:${PORT}`;

async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function bootstrapResolver() {
  const indexers = loadIndexers();
  const needsResolver = indexers.some((ix) => (ix as any).useFlareResolver);
  if (!needsResolver) {
    console.info(`[movviz] no indexer uses Cloudflare resolver — skipping resolver launch`);
    return;
  }

  if (await ping()) {
    console.info(`[movviz] resolver already running at ${BASE}`);
    return;
  }

  const entry =
    process.env.MOVVIZ_RESOLVER_ENTRY ??
    path.join(process.cwd(), "resolver", "dist", "index.js");

  if (!fs.existsSync(entry)) {
    console.warn(`[movviz] resolver entry not found (${entry}); start the resolver service manually.`);
    return;
  }

  const child = spawn(process.execPath, [entry], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  child.stdout?.on("data", (d) => {
    process.stdout.write(`[resolver] ${d}`);
    recordResolverOutput("info", String(d));
  });
  child.stderr?.on("data", (d) => {
    process.stderr.write(`[resolver] ${d}`);
    recordResolverOutput("error", String(d));
  });
  child.on("exit", (code, signal) => {
    if (code !== 0) {
      const msg = `resolver exited unexpectedly (code=${code}, signal=${signal})`;
      console.error(`[movviz] ${msg}`);
      recordResolverOutput("error", `[movviz] ${msg}`);
    }
  });
  child.unref();
  console.info(`[movviz] resolver launched → ${BASE} (${entry})`);
}

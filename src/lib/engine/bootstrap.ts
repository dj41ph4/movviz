import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { recordEngineOutput } from "./crashLog";

/**
 * Engine bootstrap — invoked once when the web server starts (see
 * `src/instrumentation.ts`). It makes sure the download engine is running so
 * that, when the machine boots and the Movviz service launches, the engine and
 * its per-category clients come online automatically. No manual step required.
 *
 * If the engine is already up (e.g. run as its own service) we leave it alone;
 * otherwise we spawn it as a detached child so it survives web restarts.
 */

const HOST = process.env.MOVVIZ_ENGINE_HOST ?? "127.0.0.1";
const PORT = process.env.MOVVIZ_ENGINE_PORT ?? "9820";
const BASE = `http://${HOST}:${PORT}`;

async function ping(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function bootstrapEngine() {
  if (await ping()) {
    console.info(`[movviz] download engine already running at ${BASE}`);
    return;
  }

  const entry =
    process.env.MOVVIZ_ENGINE_ENTRY ??
    path.join(process.cwd(), "engine", "src", "index.mjs");

  if (!fs.existsSync(entry)) {
    console.warn(
      `[movviz] engine entry not found (${entry}); start the engine service manually.`
    );
    return;
  }

  // Piped (not "ignore") so a crash on start — bad port, permission-denied
  // data dir, etc. — actually shows up in `docker logs`/the service log
  // instead of vanishing silently, which made this class of failure
  // impossible to diagnose from a NAS with no shell access.
  const child = spawn(process.execPath, [entry], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  child.stdout?.on("data", (d) => {
    process.stdout.write(`[engine] ${d}`);
    recordEngineOutput("info", String(d));
  });
  child.stderr?.on("data", (d) => {
    process.stderr.write(`[engine] ${d}`);
    recordEngineOutput("error", String(d));
  });
  child.on("exit", (code, signal) => {
    if (code !== 0) {
      const msg = `download engine exited unexpectedly (code=${code}, signal=${signal})`;
      console.error(`[movviz] ${msg}`);
      recordEngineOutput("error", `[movviz] ${msg}`);
    }
  });
  child.unref();
  console.info(`[movviz] download engine launched → ${BASE} (${entry})`);
}

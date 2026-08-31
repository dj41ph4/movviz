import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
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

  // Resolve the config directory explicitly and pass it to the engine so
  // both processes agree on where state/credentials live regardless of
  // NODE_ENV or platform heuristics — without this, the engine might pick a
  // different root than the web app (e.g. ProgramData vs .movviz-data) which
  // means a token mismatch → every API call gets 401.
  const cfgDir =
    process.env.MOVVIZ_CONFIG_DIR ??
    process.env.MOVVIZ_DATA_DIR ??
    (process.env.NODE_ENV !== "production"
      ? path.join(process.cwd(), ".movviz-data")
      : process.platform === "win32"
        ? path.join(process.env.ProgramData ?? os.homedir(), "Movviz")
        : typeof process.getuid === "function" && process.getuid() === 0
          ? "/var/lib/movviz"
          : path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "movviz"));

  const child = spawn(process.execPath, [entry], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, MOVVIZ_CONFIG_DIR: cfgDir, MOVVIZ_DATA_DIR: cfgDir },
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

import { installLogger } from "./logger.mjs";
installLogger();

import { MovvizEngine } from "./engine.mjs";
import { createApiServer } from "./api.mjs";
import {
  ENGINE_PORT,
  ENGINE_HOST,
  CONFIG_DIR,
  DATA_DIR,
  PATH_MODE,
} from "./config.mjs";

/**
 * Movviz download engine entry point. Starts the engine, then exposes it over
 * the internal REST API. Runs as its own service (port 9820), independent of
 * the web server, so downloads keep going even while the UI restarts.
 */
async function main() {
  console.log(`[engine] storage layout (${PATH_MODE}):`);
  console.log(`[engine]   config → ${CONFIG_DIR}`);
  console.log(`[engine]   media  → ${DATA_DIR}`);

  const engine = new MovvizEngine();
  await engine.start();

  const api = createApiServer(engine);
  await api.listen();
  console.log(`[engine] API listening on http://${ENGINE_HOST}:${ENGINE_PORT}`);

  const shutdown = async (signal) => {
    console.log(`[engine] ${signal} — shutting down…`);
    try {
      await api.close();
      await engine.shutdown();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", (e) => console.error("[engine] uncaught:", e));
}

main().catch((e) => {
  console.error("[engine] fatal:", e);
  process.exit(1);
});

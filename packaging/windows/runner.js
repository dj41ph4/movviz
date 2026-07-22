/*
 * Service entry point. Launched by the Windows service (and reusable elsewhere).
 * Boots the Next.js standalone server produced by `npm run build`.
 *
 * The standalone server reads PORT/HOSTNAME from the environment; the service
 * sets them (default 9810). Starting the server also fires the instrumentation
 * boot hook, which brings the auto-start download instances online.
 */

const path = require("path");

process.env.PORT = process.env.MOVVIZ_WEB_PORT || process.env.PORT || "9810";
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

// Project root is two levels up from packaging/windows/.
const root = path.resolve(__dirname, "..", "..");
const server = path.join(root, ".next", "standalone", "server.js");

try {
  require(server);
} catch (err) {
  console.error(
    "Could not start the Movviz server. Did you run `npm run build` first?"
  );
  console.error(err);
  process.exit(1);
}

/*
 * Movviz — Windows service installer.
 *
 * Registers Movviz as a Windows service that starts automatically at boot and
 * restarts on failure. Once installed, the machine brings Movviz online on
 * startup with no manual launch: the service starts the web/API server, and the
 * server's boot hook starts the auto-start download instances.
 *
 * Usage (from the project root, in an elevated shell):
 *   npm run build
 *   npm run service:install      # install + start
 *   npm run service:uninstall    # stop + remove
 *
 * Requires the optional dependency `node-windows` (installed with the project).
 */

const path = require("path");

let Service;
try {
  ({ Service } = require("node-windows"));
} catch {
  console.error(
    "node-windows is not installed. Run:  npm install node-windows  then retry."
  );
  process.exit(1);
}

const WEB_PORT = process.env.MOVVIZ_WEB_PORT || "9810";
const ENGINE_PORT = process.env.MOVVIZ_ENGINE_PORT || "9820";

const svc = new Service({
  name: "Movviz",
  description:
    "Movviz media platform — web interface, API and download engine. Starts at boot.",
  script: path.join(__dirname, "runner.js"),
  wait: 2,
  grow: 0.5,
  maxRestarts: 10, // auto-restart on failure
  env: [
    { name: "NODE_ENV", value: "production" },
    { name: "MOVVIZ_WEB_PORT", value: WEB_PORT },
    { name: "MOVVIZ_ENGINE_PORT", value: ENGINE_PORT },
    { name: "PORT", value: WEB_PORT },
    { name: "HOSTNAME", value: "0.0.0.0" },
    // App config & state; media root (torrents + library). Change the media
    // path to a data drive if you prefer, e.g. "D:\\Media".
    { name: "MOVVIZ_CONFIG_DIR", value: process.env.ProgramData ? `${process.env.ProgramData}\\Movviz` : "" },
    { name: "MOVVIZ_DATA_DIR", value: process.env.ProgramData ? `${process.env.ProgramData}\\Movviz\\data` : "" },
  ],
});

svc.on("install", () => {
  console.log(`Movviz service installed. Starting on port ${WEB_PORT}…`);
  svc.start();
});
svc.on("alreadyinstalled", () => console.log("Movviz service is already installed."));
svc.on("start", () => console.log(`Movviz is running: http://localhost:${WEB_PORT}`));
svc.on("uninstall", () => console.log("Movviz service uninstalled."));

const action = (process.argv[2] || "").toLowerCase();
if (action === "install") svc.install();
else if (action === "uninstall") svc.uninstall();
else {
  console.log("Usage: node packaging/windows/service.js <install|uninstall>");
  process.exit(1);
}

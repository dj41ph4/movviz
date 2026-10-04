import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../build/", import.meta.url);
const allowed = { "/": ["index.html", "text/html"], "/index.html": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/locales.js": ["locales.js", "text/javascript"], "/style.css": ["style.css", "text/css"], "/icon.png": ["icon.png", "image/png"] };
allowed["/Roboto-Regular.ttf"] = ["Roboto-Regular.ttf", "font/ttf"];
allowed["/qrcode.js"] = ["qrcode.js", "text/javascript"];
createServer(async (req, res) => {
  const entry = allowed[new URL(req.url, "http://localhost").pathname];
  if (!entry) { res.writeHead(404); res.end(); return; }
  try { res.setHeader("Content-Type", entry[1]); res.end(await readFile(fileURLToPath(new URL(entry[0], root)))); }
  catch { res.writeHead(500); res.end("Run npm run tizen:build first."); }
}).listen(9820, "127.0.0.1", () => process.stdout.write("Tizen preview: http://127.0.0.1:9820 (AVPlay requires Samsung TV)\n"));

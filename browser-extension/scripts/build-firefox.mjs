// Génère l'extension Firefox (dossier dist-firefox/) à partir des sources
// Chrome : mêmes fichiers, seul le manifeste change (Firefox n'a pas de service
// worker d'extension, il utilise un script d'arrière-plan « event page »).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-firefox");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const entry of ["background.js", "content", "icons", "_locales", "options.html", "options.css", "options.js"]) {
  cpSync(join(root, entry), join(out, entry), { recursive: true });
}

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));

manifest.background = { scripts: ["background.js"] };
// Firefox ne donne pas d'office l'accès aux sites des scripts de contenu :
// on les déclare en permissions d'hôte, demandées à l'installation.
manifest.host_permissions = manifest.content_scripts.flatMap((cs) => cs.matches);
manifest.browser_specific_settings = {
  gecko: {
    id: "companion@movviz.app",
    strict_min_version: "128.0",
    data_collection_permissions: { required: ["none"] },
  },
};

writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("Extension Firefox générée dans", out);

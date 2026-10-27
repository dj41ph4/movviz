import fs from "node:fs";
import { buildSettingsSearchIndex, renderIndexFile, INDEX_FILE } from "./settings-search-index.ts";

const index = buildSettingsSearchIndex();
fs.writeFileSync(INDEX_FILE, renderIndexFile(index), "utf8");
const total = Object.values(index).reduce((n, keys) => n + keys.length, 0);
console.log(`Index de recherche des Réglages : ${Object.keys(index).length} onglets, ${total} textes -> ${INDEX_FILE}`);

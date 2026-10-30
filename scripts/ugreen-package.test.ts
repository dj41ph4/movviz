import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * L'UPK UGREEN a échoué à l'activation (« Operation Failed — le conteneur ne
 * démarre pas »). Ces contrôles reprennent les règles de la documentation
 * officielle (network_mode bridge, variables déclarées, pas de latest) et
 * verrouillent ce qui rendait le démarrage fragile.
 */
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n");
const compose = read("packaging/ugreen/rootfs_common/docker-compose.yaml");
const project = read("packaging/ugreen/project.yaml");
const entrypoint = read("packaging/docker/docker-entrypoint.sh");

test("le compose suit le réseau pont de l'exemple officiel", () => {
  assert.match(compose, /^ {4}network_mode: bridge$/m);
});

test("seuls l'interface web et les ports BitTorrent sont publiés (pas le moteur ni le résolveur internes)", () => {
  const published = [...compose.matchAll(/^ {6}- "(\d+):(\d+)(?:\/(tcp|udp))?"$/gm)].map((m) => Number(m[1]));
  assert.ok(published.includes(9810), "interface web");
  assert.ok(!published.includes(9820), "le moteur écoute en 127.0.0.1 dans le conteneur");
  assert.ok(!published.includes(9830), "le résolveur est interne");
  assert.deepEqual([...new Set(published)].sort((a, b) => a - b), [9810, 55000, 55001]);
});

test("toute variable du compose est déclarée dans project.yaml (ou est le TZ intégré)", () => {
  const declared = new Set([...project.matchAll(/^ {2}- key: (\w+)$/gm)].map((m) => m[1]));
  const used = new Set([...compose.matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]));
  for (const name of used) assert.ok(name === "TZ" || declared.has(name), `${name} n'est pas déclarée`);
});

test("l'image n'utilise jamais latest et suit le motif remplacé par build.sh", () => {
  assert.match(compose, /image: dj41ph4\/movviz:0\.0\.0-ugreen/);
  assert.doesNotMatch(compose, /:latest/);
});

test("rootfs_common ne contient que l'icône et le compose (règle UGREEN)", () => {
  const files = fs.readdirSync(path.join(root, "packaging/ugreen/rootfs_common")).sort();
  assert.deepEqual(files, ["docker-compose.yaml", "icon.png"]);
});

test("un chown refusé par le système de fichiers ne tue plus le conteneur", () => {
  assert.doesNotMatch(entrypoint, /^chown movviz:movviz \/config \/data$/m, "chown nu sous set -e");
  assert.match(entrypoint, /chown movviz:movviz "\$dir" 2>\/dev\/null \|\| echo/);
  assert.match(entrypoint, /\/config n'est pas accessible en écriture/);
});

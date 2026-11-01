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

test("le paquet pose l'exigence de consentement, et elle reste propre à l'UPK", () => {
  assert.match(compose, /MOVVIZ_REQUIRE_PRIVACY_CONSENT: "1"/);
  for (const other of ["packaging/docker/docker-compose.yml", "packaging/docker/docker-compose.gpu.yml"]) {
    assert.doesNotMatch(read(other), /MOVVIZ_REQUIRE_PRIVACY_CONSENT/, `${other} ne doit pas exiger le consentement`);
  }
});

test("project.yaml : métadonnées App Center demandées par UGREEN", () => {
  for (const field of ["privacy_policy_link", "license_agreement_link", "source_code_link", "technical_support_link"]) {
    assert.match(project, new RegExp(`^${field}:\\n  - https://`, "m"), `${field} manquant`);
  }
  assert.match(project, /privacy_policy_link:\n  - https:\/\/movviz\.dj41ph4\.ovh\/privacy/);
  for (const locale of ["en-US", "fr-FR"]) {
    const block = project.split(`\n  ${locale}:\n`)[1]?.split(/\n  [a-z]{2}-[A-Z]{2}:\n|$/)[0] ?? "";
    const description = (/description: >-\n((?:      .*\n?)+)/.exec(block)?.[1] ?? "").replace(/\s+/g, " ").trim();
    assert.ok(description.length >= 100, `${locale}: description de ${description.length} caractères (minimum 100)`);
    assert.match(block, /help: https:\/\/movviz\.dj41ph4\.ovh\/help/, `${locale}: lien d'aide`);
    assert.match(block, /publisher: dj41ph4/, `${locale}: éditeur`);
    assert.match(block, /publisher_link: https:\/\//, `${locale}: lien éditeur`);
    assert.equal(/author: (.+)/.exec(block)?.[1], /publisher: (.+)/.exec(block)?.[1], `${locale}: auteur et éditeur cohérents`);
  }
});

test("le dossier du projet UPK reste minimal (build.sh le copie tel quel dans ugcli)", () => {
  const entries = fs.readdirSync(path.join(root, "packaging/ugreen")).sort();
  assert.deepEqual(entries, ["README.md", "build.sh", "project.yaml", "rootfs_common"]);
});

test("rootfs_common ne contient que l'icône et le compose (règle UGREEN)", () => {
  const files = fs.readdirSync(path.join(root, "packaging/ugreen/rootfs_common")).sort();
  assert.deepEqual(files, ["docker-compose.yaml", "icon.png"]);
});

test("un chown refusé par le système de fichiers ne tue plus le conteneur", () => {
  assert.doesNotMatch(entrypoint, /^chown movviz:movviz \/config \/data$/m, "chown nu sous set -e");
  assert.match(entrypoint, /chown movviz:movviz "\$dir" 2>\/dev\/null \|\| echo/);
  assert.match(entrypoint, /\/config n'est pas accessible en écriture/);
  // Le script est partagé par TOUTES les images : aucune vérification ne doit arrêter un démarrage
  // qui fonctionnait avant (aucun `exit 1` ajouté).
  assert.doesNotMatch(entrypoint, /^\s*exit 1/m);
  assert.doesNotMatch(entrypoint, /\|\| \{[^}]*exit 1/);
});

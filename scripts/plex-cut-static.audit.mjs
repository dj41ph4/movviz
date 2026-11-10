#!/usr/bin/env node
/**
 * Audit statique « coupure de Plex » (lecture seule, aucun serveur nécessaire).
 *   A. appels réseau vers Plex (plex.tv ou le serveur Plex) sans délai maximal  → risque de blocage infini
 *   B. interface qui conditionne une action à plexUrl / plexRatingKey           → risque de bouton absent sans Plex
 *   C. tâches planifiées qui ne testent pas plexConfigured()                    → travail inutile / boucles d'erreurs
 *   D. routes API qui importent le client Plex sans garde plexConfigured/plexLinked
 * Usage : node scripts/plex-cut-static.audit.mjs [--json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const asJson = process.argv.includes("--json");

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) yield p;
  }
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const files = [...walk(SRC)].map((p) => ({ p, src: fs.readFileSync(p, "utf8") }));

const findings = { A: [], B: [], C: [], D: [] };

// A. fetch() nu vers Plex
for (const { p, src } of files) {
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (!/(^|[^\w.])fetch\(/.test(line) || /fetchWith/.test(line) || /^\s*(\/\/|\*)/.test(line)) return;
    const window = lines.slice(i, i + 8).join("\n");
    const toPlex = /plex\.tv|serverBase\(|plexBase|\$\{base\}\/identity|cfg\.hostname|plexUrl/.test(window);
    const hasTimeout = /signal\s*:|AbortSignal|timeout/i.test(window);
    if (toPlex && !hasTimeout) findings.A.push(`${rel(p)}:${i + 1}  ${line.trim().slice(0, 110)}`);
  });
}

// B. Interface conditionnée à Plex
for (const { p, src } of files) {
  if (!/\.tsx$/.test(p)) continue;
  src.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line) || /plexUrl\??:|plexRatingKey\??:/.test(line)) return;
    if (/(plexRatingKey|plexUrl)\s*(&&|\?\s|\?\?)|!\s*\w*\.?(plexRatingKey|plexUrl)\b|\w+\?\.(plexUrl|plexRatingKey)\s*&&/.test(line))
      findings.B.push(`${rel(p)}:${i + 1}  ${line.trim().slice(0, 130)}`);
  });
}

// C. Tâches planifiées Plex sans garde
const tasks = files.find((f) => rel(f.p) === "src/lib/scheduler/tasks.ts");
if (tasks) {
  const blocks = tasks.src.split(/\n  \{\n    id: "/).slice(1);
  for (const b of blocks) {
    const id = b.slice(0, b.indexOf('"'));
    const usesPlex = /syncPlex|plex[A-Z]\w+\(|Plex\w+\(|loadPlexConfig|userMediaSync/.test(b);
    if (usesPlex && !/plexConfigured\(\)/.test(b)) findings.C.push(`tâche « ${id} » touche Plex sans plexConfigured()`);
  }
}

// D. Routes API Plex sans garde
for (const { p, src } of files) {
  if (!/src\/app\/api\/.*route\.ts$/.test(rel(p))) continue;
  if (!/from "@\/lib\/plex\/(client|librarySync|watchSync|userMediaSync|onDeckService)"/.test(src)) continue;
  if (!/plexConfigured|plex_not_configured|plex_not_connected|adminToken|cfg\.hostname|plexLinked/.test(src)) findings.D.push(rel(p));
}

if (asJson) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const titles = {
    A: "Appels réseau Plex sans délai maximal (blocage possible si Plex gèle)",
    B: "Interface conditionnée à plexUrl / plexRatingKey (à vérifier : repli local présent ?)",
    C: "Tâches planifiées touchant Plex sans plexConfigured()",
    D: "Routes API utilisant le client Plex sans garde de configuration",
  };
  for (const k of Object.keys(findings)) {
    console.log(`\n## ${k}. ${titles[k]} — ${findings[k].length}`);
    findings[k].forEach((f) => console.log("  " + f));
  }
}

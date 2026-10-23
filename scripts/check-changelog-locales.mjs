#!/usr/bin/env node
// A new release must exist in every UI language with the same version,
// section and bullet structure. This also checks the complete history.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const locales = ["en", "it", "nl", "de"];

function entries(file) {
  if (!fs.existsSync(file)) throw new Error(`Changelog manquant : ${path.basename(file)}`);
  const text = fs.readFileSync(file, "utf8");
  const headers = [...text.matchAll(/^##\s+v(\d+(?:\.\d+)+)(?:\s|$)/gm)];
  if (!headers.length) throw new Error(`Aucune version dans ${path.basename(file)}`);
  const versions = new Map();
  for (let i = 0; i < headers.length; i++) {
    const version = headers[i][1];
    if (versions.has(version)) throw new Error(`Version ${version} en double dans ${path.basename(file)}`);
    const block = text.slice(headers[i].index + headers[i][0].length, headers[i + 1]?.index ?? text.length);
    const sections = [];
    for (const line of block.split(/\r?\n/)) {
      const heading = line.match(/^###\s+(.+)$/);
      if (heading) sections.push({ heading: heading[1], bullets: [] });
      const bullet = line.match(/^-\s+(.+)$/);
      if (bullet && sections.length) sections[sections.length - 1].bullets.push(bullet[1]);
    }
    versions.set(version, sections);
  }
  return { text, versions };
}

const french = entries(path.join(root, "CHANGELOG.md"));
for (const locale of locales) {
  const file = path.join(root, `CHANGELOG.${locale}.md`);
  const translated = entries(file);
  if (translated.text === french.text) throw new Error(`${path.basename(file)} est une copie française`);
  if (translated.versions.size !== french.versions.size) throw new Error(`${path.basename(file)} : ${translated.versions.size}/${french.versions.size} versions`);
  for (const [version, source] of french.versions) {
    const target = translated.versions.get(version);
    if (!target) throw new Error(`${path.basename(file)} : version ${version} manquante`);
    if (target.length !== source.length || target.some((section, i) => !section.heading.trim()
      || section.bullets.length !== source[i].bullets.length || section.bullets.some((item) => !item.trim()))) {
      throw new Error(`${path.basename(file)} : sections ou puces de v${version} incomplètes`);
    }
  }
  console.log(`${path.basename(file)} : ${translated.versions.size} versions, structure complète`);
}

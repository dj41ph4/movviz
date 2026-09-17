import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readEntry, readRange } from "@/lib/changelog";

function writeTempChangelog(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-changelog-"));
  const file = path.join(dir, "CHANGELOG.md");
  fs.writeFileSync(file, content, "utf8");
  return file;
}

/**
 * Bug réel confirmé en direct (2026-09) : le popup "Nouveautés" tronquait
 * chaque item enroulé sur plusieurs lignes à sa seule première ligne — les
 * entrées v1.25.21/22/23 du vrai CHANGELOG.md enroulent leurs puces
 * (convention markdown normale pour la lisibilité en revue de diff), mais
 * le parser ne traitait que les lignes commençant strictement par "- ".
 */
test("readEntry() reconstitue un item enroulé sur plusieurs lignes sans le tronquer", () => {
  const file = writeTempChangelog(`## v9.9.9 — September 2026

### Titre de section

- Première ligne d'un item très long qui
  continue sur une deuxième ligne indentée et
  se termine ici.
- Item court sur une seule ligne.
`);
  const entry = readEntry(file, "9.9.9");
  assert.ok(entry);
  assert.deepEqual(entry!.sections[0].items, [
    "Première ligne d'un item très long qui continue sur une deuxième ligne indentée et se termine ici.",
    "Item court sur une seule ligne.",
  ]);
});

test("readRange() reconstitue aussi les items enroulés (chemin utilisé par le popup Nouveautés)", () => {
  const file = writeTempChangelog(`## v2.0.0 — September 2026

### Section A

- Un item enroulé sur
  deux lignes.

## v1.0.0 — September 2026

### Section B

- Un autre item enroulé
  sur deux lignes aussi.
`);
  const range = readRange(file);
  assert.equal(range.length, 2);
  assert.deepEqual(range[0].sections[0].items, ["Un item enroulé sur deux lignes."]);
  assert.deepEqual(range[1].sections[0].items, ["Un autre item enroulé sur deux lignes aussi."]);
});

test("une ligne blanche entre deux sections n'est pas fusionnée dans un item", () => {
  const file = writeTempChangelog(`## v1.0.0 — September 2026

### Section

- Item normal.

### Autre section

- Deuxième item.
`);
  const entry = readEntry(file, "1.0.0");
  assert.ok(entry);
  assert.deepEqual(entry!.sections.map((s) => s.items), [["Item normal."], ["Deuxième item."]]);
});

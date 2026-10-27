import fs from "node:fs";
import path from "node:path";
import { fr } from "../src/i18n/locales/fr.ts";

/**
 * Construit l'index de recherche des Réglages : pour chaque onglet, les clés de traduction
 * utilisées par ses panneaux (libellés, descriptions, boutons…). La recherche peut ainsi
 * trouver un réglage par son contenu, pas seulement par le titre de l'onglet.
 *
 * Source de vérité : src/app/settings/page.tsx (quel panneau pour quel onglet) et le code
 * des panneaux (quelles clés `t("…")` ils affichent, sous-composants compris).
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
export const INDEX_FILE = path.join(SRC, "lib", "settingsSearchIndex.generated.ts");

/** Clés communes à tous les écrans (Enregistrer, Annuler…) : elles feraient matcher tous les onglets. */
const IGNORED_PREFIXES = ["common."];
/** Une clé dynamique `t("préfixe." + id)` ajoute tout le préfixe, dans cette limite. */
const MAX_PREFIX_KEYS = 200;
/** Dossiers de composants suivis depuis un panneau (les sous-composants des réglages). */
const FOLLOWED_DIRS = ["components/settings/", "components/downloads/", "components/library/"];

function flatten(obj: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") flatten(v, key, out);
  }
  return out;
}

const DICT = flatten(fr);
const ALL_KEYS = Object.keys(DICT);

function resolveImport(spec: string): string | null {
  if (!spec.startsWith("@/")) return null;
  const rel = spec.slice(2);
  if (!FOLLOWED_DIRS.some((d) => rel.startsWith(d))) return null;
  for (const ext of [".tsx", ".ts"]) {
    const file = path.join(SRC, rel + ext);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/** Fichier du panneau + ses sous-composants (imports `@/components/settings/…`, récursif). */
function collectFiles(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const code = fs.readFileSync(entry, "utf8");
  for (const m of code.matchAll(/from\s+["']([^"']+)["']/g)) {
    const file = resolveImport(m[1]);
    if (file) collectFiles(file, seen);
  }
  return seen;
}

function keysOf(code: string): Set<string> {
  const keys = new Set<string>();
  // t("a.b.c") ou t(`a.b.c`) — clé littérale.
  for (const m of code.matchAll(/\bt\(\s*["'`]([A-Za-z0-9_.-]+)["'`]/g)) if (DICT[m[1]] !== undefined) keys.add(m[1]);
  // t("a.b." + x) ou t(`a.b.${x}`) — clé dynamique : tout le préfixe.
  for (const m of code.matchAll(/\bt\(\s*(?:["']([A-Za-z0-9_.-]+\.)["']\s*\+|`([A-Za-z0-9_.-]+\.)\$\{)/g)) {
    const prefix = m[1] ?? m[2];
    const found = ALL_KEYS.filter((k) => k.startsWith(prefix));
    if (found.length > 0 && found.length <= MAX_PREFIX_KEYS) found.forEach((k) => keys.add(k));
  }
  return keys;
}

/** onglet → fichiers des composants rendus par page.tsx pour cet onglet. */
function tabEntries(): Map<string, string[]> {
  const pageFile = path.join(SRC, "app", "settings", "page.tsx");
  const page = fs.readFileSync(pageFile, "utf8");
  const imports = new Map<string, string>();
  for (const m of page.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    for (const name of m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()!).filter(Boolean)) imports.set(name, m[2]);
  }
  const marks = [...page.matchAll(/\{tab === "([a-z]+)"/g)];
  const result = new Map<string, string[]>();
  marks.forEach((mark, i) => {
    const id = mark[1];
    if (id === "home") return;
    const chunk = page.slice(mark.index!, i + 1 < marks.length ? marks[i + 1].index : undefined);
    const files: string[] = [];
    for (const c of chunk.matchAll(/<([A-Z][A-Za-z0-9]+)/g)) {
      const spec = imports.get(c[1]);
      const file = spec ? resolveImport(spec) : null;
      if (file && !files.includes(file)) files.push(file);
    }
    if (files.length > 0) result.set(id, files);
  });
  return result;
}

export function buildSettingsSearchIndex(): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const [id, entries] of tabEntries()) {
    const keys = new Set<string>();
    const files = new Set<string>();
    for (const entry of entries) collectFiles(entry, files);
    for (const file of files) for (const k of keysOf(fs.readFileSync(file, "utf8"))) keys.add(k);
    index[id] = [...keys].filter((k) => !IGNORED_PREFIXES.some((p) => k.startsWith(p))).sort();
  }
  return Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
}

export function renderIndexFile(index: Record<string, string[]>): string {
  const body = Object.entries(index)
    .map(([id, keys]) => `  ${JSON.stringify(id)}: [\n${keys.map((k) => `    ${JSON.stringify(k)},`).join("\n")}\n  ],`)
    .join("\n");
  return `// Généré par scripts/generate-settings-search-index.ts (npm run gen:settings-search) — ne pas modifier à la main.\n// Clés de traduction affichées dans les panneaux de chaque onglet des Réglages.\nexport const SETTINGS_SEARCH_KEYS: Record<string, string[]> = {\n${body}\n};\n`;
}

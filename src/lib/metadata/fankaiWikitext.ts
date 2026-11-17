/**
 * Pure reading of the Fan-Kai wiki (fan-kai.fandom.com/fr): a page per fan
 * version of an anime (« Kaï », « Henshū », « Yabai », « FAN-CUT », « Recut »),
 * opened by a `{{Fiche_Série|…}}` box and followed by a table with one row per
 * part (« film »). No network here — `fankai.ts` fetches, this module only
 * turns wikitext into data, so the tests can run it on real pages.
 *
 * The part tables are written by hand and their columns differ from one page
 * to the next (SAGAS/ARCS/SAISONS on the left with rowspans, then FILMS,
 * CHAPITRES, ÉPISODES, DURÉE, AFFICHES, AVANCEMENT in any order). The cells
 * on the left of the `{{Resume}}` cell vary per row because of the rowspans,
 * the ones on its right never do: they are read against the LAST headers of
 * the table, and recognised by their content first (poster, duration,
 * progress mark) so a missing cell cannot shift the others.
 */

export interface FankaiFiche {
  posterFile: string | null;
  kaieur: string | null;
  /** Kai, Henshū, Yabai, FAN-CUT, Recut… as written on the wiki. */
  kind: string | null;
  status: string | null;
  source: string | null;
  quality: string | null;
  languages: string | null;
  anilistId: number | null;
  malId: number | null;
  /** Number of episodes of the original series, when the page gives one. */
  originalEpisodes: number | null;
}

export interface FankaiPart {
  number: number;
  title: string;
  synopsis: string;
  /** Episodes of the original series this part is cut from (« 1-5 »). */
  episodes: string | null;
  chapters: string | null;
  /** Minutes. */
  runtime: number | null;
  posterFile: string | null;
  /** False when the wiki marks the part as not out yet. */
  released: boolean;
}

export interface FankaiPage {
  fiche: FankaiFiche;
  synopsis: string;
  parts: FankaiPart[];
}

/** Fan-version suffixes: the last word(s) of a fan version's title. */
const FAN_MARKER = String.raw`(?:ka[iï]|hensh[uū]|yaba[iï]|fan[-/ ]?cut|recut)`;
const FAN_MARKER_END_RE = new RegExp(String.raw`(?:^|[\s._-])${FAN_MARKER}(?:\s+ultime\s+pack)?\s*$`, "i");

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** True when a title ends with a fan-version marker (« Death Note Kaï », « Bleach Yabai »). */
export function hasFanMarker(title: string): boolean {
  const base = title.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return FAN_MARKER_END_RE.test(base);
}

/** Wiki page → shown title: the files and the community write « Kaï ». */
export function fankaiDisplayTitle(pageTitle: string): string {
  return pageTitle.replace(/\bKai\b/g, "Kaï").replace(/\bFAN\/CUT\b/g, "FAN-CUT").trim();
}

/** The series a fan version is cut from: « Death Note Kaï (Roro) » → « Death Note ». */
export function fankaiBaseTitle(pageTitle: string): string {
  return pageTitle
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(new RegExp(String.raw`\s+${FAN_MARKER}(?:\s+ultime\s+pack)?\s*$`, "i"), "")
    .trim();
}

/**
 * Stable numeric id of a fan version, in a range TMDb never reaches (its
 * series ids are six digits) and that still fits a 32-bit Int, which the
 * Android clients use for every tmdbId. Hash of the normalised page title,
 * so a cache rebuild or a reordered wiki never renumbers a library entry.
 */
export const FANKAI_ID_MIN = 1_900_000_000;
export const FANKAI_ID_MAX = 1_999_999_999;
export function fankaiIdFor(pageTitle: string): number {
  const key = stripAccents(pageTitle).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return FANKAI_ID_MIN + (hash % (FANKAI_ID_MAX - FANKAI_ID_MIN + 1));
}
export function isFankaiId(id: number): boolean {
  return Number.isInteger(id) && id >= FANKAI_ID_MIN && id <= FANKAI_ID_MAX;
}

export function parseRedirect(wikitext: string): string | null {
  return wikitext.match(/^\s*#(?:REDIRECTION|REDIRECT)\s*\[\[([^\]|#]+)/i)?.[1]?.trim() ?? null;
}

/** Splits a template body on its top-level pipes (not those inside [[…]] or {{…}}). */
export function splitTemplateArgs(body: string): string[] {
  const args: string[] = [];
  let depthSquare = 0;
  let depthCurly = 0;
  let current = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "[[") { depthSquare++; current += two; i++; continue; }
    if (two === "]]" && depthSquare > 0) { depthSquare--; current += two; i++; continue; }
    if (two === "{{") { depthCurly++; current += two; i++; continue; }
    if (two === "}}" && depthCurly > 0) { depthCurly--; current += two; i++; continue; }
    if (body[i] === "|" && depthSquare === 0 && depthCurly === 0) { args.push(current); current = ""; continue; }
    current += body[i];
  }
  args.push(current);
  return args;
}

/** Finds `{{name|…}}` from `from` and returns its body and end offset, braces balanced. */
function findTemplate(text: string, name: RegExp, from = 0): { body: string; start: number; end: number } | null {
  const re = new RegExp(String.raw`\{\{\s*${name.source}\s*\|`, "gi");
  re.lastIndex = from;
  const match = re.exec(text);
  if (!match) return null;
  let depth = 0;
  for (let i = match.index; i < text.length - 1; i++) {
    if (text[i] === "{" && text[i + 1] === "{") { depth++; i++; continue; }
    if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return { body: text.slice(match.index + match[0].length, i - 1), start: match.index, end: i + 1 };
    }
  }
  return null;
}

/** Wiki markup → readable text. */
export function stripWikiMarkup(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\{\{!\}\}/g, "|")
    .replace(/\[\[(?:Fichier|File|Image):[^\]]*\]\]/gi, "")
    .replace(/\[\[Catégorie:[^\]]*\]\]/gi, "")
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
    .replace(/\[https?:\/\/[^\]\s]+\]/g, "")
    .replace(/'{2,}/g, "")
    .replace(/^=+\s*(.*?)\s*=+$/gm, "$1")
    .replace(/__[A-Z]+__/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fileName(value: string): string | null {
  const match = value.match(/\[\[(?:Fichier|File|Image):([^\]|]+)/i);
  const raw = match?.[1] ?? value.trim();
  const name = raw.replace(/^(?:Fichier|File|Image):/i, "").trim();
  return /\.(?:png|jpe?g|webp)$/i.test(name) ? name : null;
}

function firstNumber(value: string): number | null {
  const n = value.match(/\d+/)?.[0];
  return n ? Number(n) : null;
}

export function parseFiche(wikitext: string): { fiche: FankaiFiche; end: number } | null {
  const template = findTemplate(wikitext, /Fiche[_ ]S[ée]rie/);
  if (!template) return null;
  const fields = new Map<string, string>();
  for (const arg of splitTemplateArgs(template.body)) {
    const eq = arg.indexOf("=");
    if (eq < 0) continue;
    fields.set(stripAccents(arg.slice(0, eq)).trim().toLowerCase(), arg.slice(eq + 1).trim());
  }
  const text = (key: string) => {
    const raw = fields.get(key);
    if (raw == null) return null;
    const clean = stripWikiMarkup(raw).replace(/\s*\n\s*/g, " · ").trim();
    return clean || null;
  };
  const links = fields.get("al_-_mal") ?? "";
  const episodes = fields.get("episodes") ?? "";
  return {
    end: template.end,
    fiche: {
      posterFile: fileName(fields.get("image1") ?? ""),
      kaieur: text("kaieur"),
      kind: text("type"),
      status: text("statut"),
      source: text("source"),
      quality: text("qualite"),
      languages: text("langue(s)"),
      anilistId: firstNumber(links.match(/anilist\.co\/anime\/(\d+)/i)?.[1] ?? ""),
      malId: firstNumber(links.match(/myanimelist\.net\/anime\/(\d+)/i)?.[1] ?? ""),
      originalEpisodes: /^\s*\d+\s*$/.test(stripWikiMarkup(episodes)) ? Number(stripWikiMarkup(episodes)) : null,
    },
  };
}

interface Table { headers: string[]; rows: string[][] }

/** Splits `{| … |}` blocks into header labels and rows of raw cells. */
export function parseTables(wikitext: string): Table[] {
  const tables: Table[] = [];
  const re = /^\{\|.*$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(wikitext))) {
    const start = match.index + match[0].length;
    // Nested tables do not occur on the wiki: the first closing line ends it.
    const close = wikitext.slice(start).search(/^\|\}/m);
    const body = close < 0 ? wikitext.slice(start) : wikitext.slice(start, start + close);
    re.lastIndex = close < 0 ? wikitext.length : start + close + 2;
    const headers: string[] = [];
    const rows: string[][] = [];
    let row: string[] | null = null;
    let cell: string | null = null;
    const flushCell = () => { if (row && cell != null) row.push(cell); cell = null; };
    const flushRow = () => { flushCell(); if (row && row.length) rows.push(row); row = null; };
    for (const line of body.split("\n")) {
      if (/^\|-/.test(line)) { flushRow(); row = []; continue; }
      if (/^!/.test(line)) {
        flushCell();
        for (const label of line.slice(1).split("!!")) headers.push(cellContent(label));
        continue;
      }
      if (/^\|\+/.test(line)) continue;
      if (/^\|/.test(line)) {
        flushCell();
        row ??= [];
        const parts = splitInlineCells(line.slice(1));
        for (let i = 0; i < parts.length - 1; i++) row.push(parts[i]);
        cell = parts[parts.length - 1];
        continue;
      }
      if (cell != null) cell += `\n${line}`;
    }
    flushRow();
    tables.push({ headers, rows });
  }
  return tables;
}

/** `a || b` on one line, ignoring the pipes of templates and links. */
function splitInlineCells(line: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const two = line.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth++; current += two; i++; continue; }
    if ((two === "}}" || two === "]]") && depth > 0) { depth--; current += two; i++; continue; }
    if (two === "||" && depth === 0) { out.push(current); current = ""; i++; continue; }
    current += line[i];
  }
  out.push(current);
  return out;
}

/** Drops a cell's attribute prefix (`colspan="2" rowspan="4" | …`). */
function cellContent(raw: string): string {
  const pipe = topLevelPipe(raw);
  const head = pipe >= 0 ? raw.slice(0, pipe) : "";
  const value = pipe >= 0 && /^\s*(?:[a-z-]+\s*=\s*("[^"]*"|\S+)\s*)+$/i.test(head) ? raw.slice(pipe + 1) : raw;
  return stripWikiMarkup(value).toUpperCase().trim();
}

function topLevelPipe(value: string): number {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const two = value.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth++; i++; continue; }
    if ((two === "}}" || two === "]]") && depth > 0) { depth--; i++; continue; }
    if (value[i] === "|" && depth === 0) return i;
  }
  return -1;
}

const RUNTIME_RE = /^\s*(\d{1,2})\s*h\s*(\d{1,2})\s*(?:min)?\s*$/i;
const CLOCK_RUNTIME_RE = /^\s*(\d{1,2}):(\d{2}):(\d{2})\s*$/;
const PROGRESS_RE = /[✅❌⌛⌚🚧⏳🔄🕐🛠✔✖]|\b(?:à venir|en cours|termin[ée])\b/i;
const NOT_RELEASED_RE = /[❌⌛⌚🚧⏳🔄🛠✖]|à venir|en cours/i;
/** A part cell without the Resume template: « 1 - Kira », « 1- Le Poids d'une Vie ». */
const PLAIN_PART_RE = /^\s*(?:No\.?\s*)?(\d{1,4})\s*[-–—]\s*(?!\d)(\S.*)$/is;

/** A body cell's value, without its attribute prefix (`rowspan="2" |…`). */
function cellValue(raw: string): string {
  const pipe = topLevelPipe(raw);
  if (pipe < 0) return raw;
  return /^\s*(?:[a-z-]+\s*=\s*("[^"]*"|\S+)\s*)+$/i.test(raw.slice(0, pipe)) ? raw.slice(pipe + 1) : raw;
}

function parseRuntime(value: string): number | null {
  const text = stripWikiMarkup(cellValue(value));
  const match = text.match(RUNTIME_RE);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const clock = text.match(CLOCK_RUNTIME_RE);
  return clock ? Number(clock[1]) * 60 + Number(clock[2]) + (Number(clock[3]) >= 30 ? 1 : 0) : null;
}

function plainPart(cell: string): { number: number; title: string; synopsis: string } | null {
  const text = stripWikiMarkup(cellValue(cell)).replace(/\s+/g, " ").trim();
  const match = text.match(PLAIN_PART_RE);
  return match ? { number: Number(match[1]), title: match[2].trim(), synopsis: "" } : null;
}

function parseResume(cell: string): Omit<FankaiPart, "episodes" | "chapters" | "runtime" | "posterFile" | "released"> | null {
  const template = findTemplate(cell, /Resume/);
  if (!template) return null;
  const [heading = "", synopsis = "", numberArg = ""] = splitTemplateArgs(template.body);
  const head = stripWikiMarkup(heading);
  const numbered = head.match(/^\s*(?:No\.?\s*)?(\d{1,4})\s*[-–—:.]\s*(.+)$/is);
  const number = numbered ? Number(numbered[1]) : firstNumber(numberArg);
  if (number == null) return null;
  return {
    number,
    title: (numbered ? numbered[2] : head).replace(/\s+/g, " ").trim(),
    synopsis: stripWikiMarkup(synopsis).replace(/\s*\n\s*/g, " ").trim(),
  };
}

function rangeText(value: string): string | null {
  const clean = stripWikiMarkup(cellValue(value)).split(/\s*\n\s*/).filter(Boolean).join(", ").replace(/[ \t]+/g, " ").trim();
  return /\d/.test(clean) ? clean.replace(/\s*[-–—]\s*/g, "-") : null;
}

function partsOfTable(table: Table): FankaiPart[] {
  const parts: FankaiPart[] = [];
  for (const row of table.rows) {
    let index = row.findIndex((cell) => /\{\{\s*Resume\s*\|/i.test(cell));
    let resume = index >= 0 ? parseResume(row[index]) : null;
    if (index < 0) {
      index = row.findIndex((cell) => !fileName(cell) && plainPart(cell) != null);
      resume = index >= 0 ? plainPart(row[index]) : null;
    }
    if (!resume) continue;
    const after = row.slice(index + 1);
    const labels = table.headers.slice(Math.max(0, table.headers.length - after.length));
    const part: FankaiPart = { ...resume, episodes: null, chapters: null, runtime: null, posterFile: null, released: true };
    let progress: string | null = null;
    after.forEach((raw, i) => {
      const label = stripAccents(labels[i] ?? "");
      const poster = fileName(raw);
      if (poster) { part.posterFile ??= poster; return; }
      const runtime = parseRuntime(raw);
      if (runtime != null) { part.runtime ??= runtime; return; }
      const text = stripWikiMarkup(cellValue(raw));
      if (/AVANCEMENT/.test(label) || (PROGRESS_RE.test(text) && !/\d/.test(text))) { progress ??= text; return; }
      if (/EPISOD/.test(label)) { part.episodes ??= rangeText(raw); return; }
      if (/CHAPI|CHAPTER/.test(label)) { part.chapters ??= rangeText(raw); return; }
      if (/DUR/.test(label) && NOT_RELEASED_RE.test(text)) { progress ??= text; }
    });
    if (progress && NOT_RELEASED_RE.test(progress)) part.released = false;
    parts.push(part);
  }
  return parts;
}

/**
 * Parts of the page, in order. A page sometimes holds the tables of several
 * versions (One Piece: Yabai, Kai, Deluxe…): a table whose numbering starts
 * over belongs to another version and ends this one, while a table that
 * carries on the numbering (two seasons in two tables) is kept.
 */
export function parseParts(wikitext: string): FankaiPart[] {
  const parts: FankaiPart[] = [];
  for (const table of parseTables(wikitext)) {
    const tableParts = partsOfTable(table);
    if (tableParts.length === 0) continue;
    const last = parts.at(-1)?.number ?? 0;
    if (parts.length > 0 && tableParts[0].number <= last) break;
    parts.push(...tableParts);
  }
  const seen = new Set<number>();
  return parts.filter((part) => (seen.has(part.number) ? false : (seen.add(part.number), true)));
}

export function parseFankaiPage(wikitext: string): FankaiPage | null {
  const parsed = parseFiche(wikitext);
  if (!parsed) return null;
  const rest = wikitext.slice(parsed.end);
  const tableStart = rest.search(/^\{\||__TOC__|^==/m);
  const synopsis = stripWikiMarkup(tableStart < 0 ? rest : rest.slice(0, tableStart)).replace(/\s*\n\s*/g, "\n").trim();
  return { fiche: parsed.fiche, synopsis, parts: parseParts(wikitext) };
}

/**
 * A Fan-Kai file or torrent name: « [Odji-san] Death Note Kaï - 01 - Light vs
 * L Partie 1 1080p Multi x264 », « One Piece Yabai - 008 - La Route… - 1080p
 * [Mixouille] ». Returns the fan version's title and the part number (null
 * for a whole-series pack). Only fires when the title ENDS with a fan marker,
 * so « Jujutsu Kaisen » or « Boku no Kokoro no Yabai Yatsu » never match.
 * Indexer packs often carry the original anime's year after the marker
 * (« Naruto.Yabai.2002.INTEGRALE.MULTi…-FanKai »).
 */
export function parseFankaiReleaseName(rawName: string): { title: string; part: number | null } | null {
  const name = rawName
    .replace(/\.(?:mkv|mp4|avi|m4v|ts|webm)$/i, "")
    .replace(/^\s*(?:\[[^\]]*\]\s*)+/, "")
    .replace(/[._]+/g, (m) => (m.length === 1 ? " " : m))
    .trim();
  const withPart = name.match(new RegExp(String.raw`^(.+?\s${FAN_MARKER}(?:\s+ultime\s+pack)?)(?:\s*\([^)]*\))?(?:\s+(?:19|20)\d{2})?\s+-\s+(\d{1,4})(?:\s+-\s+|\s*$|\s+(?=\d{3,4}p\b))`, "i"));
  if (withPart) return { title: withPart[1].trim(), part: Number(withPart[2]) };
  const pack = name.match(new RegExp(String.raw`^(.+?\s${FAN_MARKER}(?:\s+ultime\s+pack)?)(?=\s*(?:\([^)]*\)\s*)?(?:\s*(?:19|20)\d{2}\b)?(?:\[|[-\s](?:int[ée]grale|complete|multi|vostfr|vf|\d{3,4}p)\b|$))`, "i"));
  if (pack && !/\s-\s\d/.test(name.slice(pack[1].length, pack[1].length + 8))) return { title: pack[1].trim(), part: null };
  return null;
}

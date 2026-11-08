// Appariement fichier ↔ épisode par TITRE pour les packs dont les fichiers ne portent
// ni saison ni épisode exploitables (« 002 Le Chat et La Souris (2e partie).mkv »).
//
// Pourquoi : la numérotation d'un tel pack (ordre de production, ordre de diffusion
// d'un autre pays…) ne correspond presque jamais à celle de TMDb. Se fier au numéro
// rangeait « Le Chat et la Souris (2) » sous « Le Duel » (Batman, série animée).
// Le titre, lui, est le même des deux côtés à la ponctuation, aux accents et à la
// mention « (1re partie) » / « (1) » près.

const DIACRITICS_RE = /[̀-ͯ]/g;
const STOPWORDS = new Set([
  "le", "la", "les", "l", "un", "une", "de", "du", "des", "d", "the", "a", "an", "of", "et", "and", "und", "en", "au", "aux", "a",
]);
const VIDEO_EXT_RE = /\.(mkv|mp4|avi|m4v|mov|wmv|ts|m2ts|webm)$/i;

/** Titre normalisé d'un nom de fichier ou d'un titre d'épisode : sans numéro de tête,
 *  sans extension, sans accents ni ponctuation, partie (1re partie, (1), part 1) extraite. */
export function normalizeEpisodeTitle(raw) {
  let s = String(raw ?? "").replace(VIDEO_EXT_RE, "");
  s = s.replace(/^\s*\d{1,4}\s*[-._)\]]*\s+/, " ");
  s = s.toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
  s = s.replace(/&/g, " et ").replace(/['’`]/g, " ");
  let part = null;
  const takePart = (re) => {
    const m = s.match(re);
    if (!m) return false;
    part = Number(m[1]);
    s = s.replace(re, " ");
    return true;
  };
  takePart(/\(?\b(\d)\s*(?:re|ere|e|eme|st|nd|rd|th)?\s*(?:partie|part)\b\)?/)
    || takePart(/\(?\b(?:partie|part)\s*(\d)\b\)?/)
    || takePart(/\((\d)\)\s*$/);
  s = s.replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = s.split(" ").filter(Boolean);
  const significant = tokens.filter((t) => !STOPWORDS.has(t));
  return { base: tokens.join(" "), tokens: significant.length ? significant : tokens, part };
}

function bigrams(s) {
  const set = new Map();
  const t = s.replace(/ /g, "");
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    set.set(g, (set.get(g) ?? 0) + 1);
  }
  return set;
}

/** Dice sur les bigrammes de lettres (tolère « Amour on ice » ≈ « Amour de Glace » à peine, mais
 *  rattrape « Harley & Ivy » / « Harley et Ivy », « Joyeux Noël » / « Joyeux Noel »). */
function similarity(a, b) {
  const ta = a.tokens.join(" ");
  const tb = b.tokens.join(" ");
  if (!ta || !tb) return 0;
  if (ta === tb) return 1;
  const ga = bigrams(ta);
  const gb = bigrams(tb);
  let inter = 0;
  for (const [g, n] of ga) inter += Math.min(n, gb.get(g) ?? 0);
  const total = [...ga.values()].reduce((x, y) => x + y, 0) + [...gb.values()].reduce((x, y) => x + y, 0);
  return total ? (2 * inter) / total : 0;
}

const partsCompatible = (a, b) => a.part == null || b.part == null || a.part === b.part;

function fileNumber(name) {
  const m = String(name ?? "").match(/^\s*(\d{1,4})\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Associe chaque fichier « sans saison ni épisode » au titre d'épisode ciblé qui lui correspond.
 *
 * @param files   [{ name, path, length? }]  — fichiers vidéo du torrent
 * @param targets [{ season, episode, title? }] — épisodes visés (titres fournis par Movviz)
 * @param isCandidate (file) => boolean — vrai si le nom du fichier ne porte aucune saison/épisode
 * @returns Map<file.path, target> des fichiers appariés, ou null si le mode « titre » ne s'applique pas
 *          (pas de titres, pas assez de fichiers candidats, appariement peu fiable).
 */
export function assignFilesByTitle(files, targets, isCandidate) {
  const titled = (targets ?? []).filter((t) => typeof t?.title === "string" && t.title.trim());
  if (titled.length === 0) return null;
  const candidates = files.filter((f) => VIDEO_EXT_RE.test(f.name) && isCandidate(f));
  if (candidates.length === 0) return null;

  const fileInfo = new Map(candidates.map((f) => [f, normalizeEpisodeTitle(f.name)]));
  const targetInfo = new Map(titled.map((t) => [t, normalizeEpisodeTitle(t.title)]));
  const assigned = new Map(); // file → target
  const usedTargets = new Set();

  const pair = (file, target) => { assigned.set(file, target); usedTargets.add(target); };

  // 1. Titre identique, partie comprise.
  const byKey = new Map();
  for (const t of titled) {
    const info = targetInfo.get(t);
    const key = `${info.base}#${info.part ?? ""}`;
    byKey.set(key, byKey.has(key) ? null : t); // null = ambigu côté cibles
  }
  for (const f of candidates) {
    const info = fileInfo.get(f);
    if (!info.base) continue;
    const t = byKey.get(`${info.base}#${info.part ?? ""}`);
    if (t && !usedTargets.has(t)) pair(f, t);
  }

  // 2. Même titre sans tenir compte des mots vides, parties compatibles et univoques.
  const remaining = () => ({
    files: candidates.filter((f) => !assigned.has(f)),
    targets: titled.filter((t) => !usedTargets.has(t)),
  });
  {
    const { files: rf, targets: rt } = remaining();
    for (const f of rf) {
      const fi = fileInfo.get(f);
      const options = rt.filter((t) => !usedTargets.has(t) && partsCompatible(fi, targetInfo.get(t)) && fi.tokens.join(" ") === targetInfo.get(t).tokens.join(" "));
      if (options.length === 1) pair(f, options[0]);
    }
  }

  // 3. Proximité des titres (glouton, meilleurs scores d'abord, jamais à égalité douteuse).
  {
    const { files: rf, targets: rt } = remaining();
    const scored = [];
    for (const f of rf) for (const t of rt) {
      const fi = fileInfo.get(f);
      const ti = targetInfo.get(t);
      if (!partsCompatible(fi, ti)) continue;
      const score = similarity(fi, ti);
      if (score >= 0.72) scored.push({ f, t, score });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const { f, t, score } of scored) {
      if (assigned.has(f) || usedTargets.has(t)) continue;
      // Un concurrent presque aussi bon pour la même cible = ambigu : on n'invente pas.
      const rival = scored.find((s) => s !== scoredPair(f, t, scored) && !assigned.has(s.f) && !usedTargets.has(s.t) && (s.f === f || s.t === t) && s.score >= score - 0.05);
      if (rival) continue;
      pair(f, t);
    }
  }

  // Fiabilité : si moins de 60 % des plus petits des deux ensembles sont appariés par le titre,
  // le pack n'est pas du genre « titres » et on laisse l'ancienne logique numérotée faire son travail.
  const confident = assigned.size;
  if (confident < Math.max(1, Math.ceil(0.6 * Math.min(candidates.length, titled.length)))) return null;

  // 4. Restes : titres traduits différemment (« Amour de Glace » / « Amour on ice »). Le décalage
  //    entre le numéro du fichier et le rang de l'épisode est constant autour d'un épisode isolé :
  //    on s'en sert uniquement quand les deux voisins appariés s'accordent, jamais autrement.
  {
    const ordered = [...titled].sort((x, y) => x.season - y.season || x.episode - y.episode);
    const ordinal = new Map(ordered.map((t, i) => [t, i]));
    const offsets = new Map(); // ordinal → numéro du fichier − ordinal
    for (const [f, t] of assigned) {
      const n = fileNumber(f.name);
      if (n != null) offsets.set(ordinal.get(t), n - ordinal.get(t));
    }
    const sortedOrdinals = [...offsets.keys()].sort((x, y) => x - y);
    for (const t of ordered) {
      if (usedTargets.has(t)) continue;
      const k = ordinal.get(t);
      const before = [...sortedOrdinals].reverse().find((o) => o < k);
      const after = sortedOrdinals.find((o) => o > k);
      const offBefore = before != null ? offsets.get(before) : undefined;
      const offAfter = after != null ? offsets.get(after) : undefined;
      if (offBefore != null && offAfter != null && offBefore !== offAfter) continue;
      const offset = offBefore ?? offAfter;
      if (offset == null) continue;
      const wanted = k + offset;
      const f = candidates.find((c) => !assigned.has(c) && fileNumber(c.name) === wanted && partsCompatible(fileInfo.get(c), targetInfo.get(t)));
      if (f) pair(f, t);
    }
  }

  const byPath = new Map();
  for (const [f, t] of assigned) byPath.set(f.path ?? f.name, t);
  return byPath;
}

function scoredPair(f, t, scored) {
  return scored.find((s) => s.f === f && s.t === t);
}

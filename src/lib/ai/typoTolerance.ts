/**
 * Typo tolerance for the chat's deterministic detectors.
 *
 * Every detector (« appelle-moi maître », « je l'ai déjà vu », « tu peux
 * faire quoi », « recommande-moi »…) is a regex written against correctly
 * spelled French, so « apelle moi », « deja vu », « recomande » or « episdoe »
 * slipped through and the model was left to guess. Rather than loosening each
 * regex one by one, the user's message is first brought back to the
 * detectors' vocabulary: a word that is not in it but sits one typo away
 * (two for long words) from exactly one vocabulary word is replaced by that
 * word. Only the detectors read the corrected text — titles are still looked
 * up as typed (see the chat route: extractors try the raw message first).
 */

// Canonical spellings the detectors are written against (accents kept: some
// regexes spell « déjà », « épisode » literally). Words shorter than 4
// letters are never corrected (too many real words one letter apart).
const VOCABULARY = [
  // addressing, names, submission
  "appelle", "appeler", "appelez", "appelles", "prénom", "nomme", "maître", "maîtresse", "seigneur", "majesté",
  "altesse", "patron", "patronne", "obéis", "obéir", "soumets", "genoux", "agenouille", "prosterne", "appartiens",
  "esclave", "serviteur", "servante", "larbin", "domestique", "souviens", "rappelles",
  // tone of the conversation
  "arrête", "arrêter", "arrêtez", "calme", "sérieux", "sérieuse", "trompes", "trompe", "compris", "répètes",
  "répète", "toujours", "jamais", "phrase", "phrases", "programmée", "recyclée", "termine", "pourquoi", "comment",
  "combien", "quand", "quelle", "quelles", "quels", "encore", "contraire", "regardé", "regarder", "regarde",
  "mauvaise", "réponse", "censée", "conseiller", "conseille", "conseil", "conseils",
  // seen / library / actions
  "déjà", "vu", "vus", "vue", "vues", "marque", "marquer", "ajoute", "ajouter", "télécharge", "télécharger",
  "supprime", "supprimer", "enlève", "retire", "retirer", "bibliothèque", "liste", "dispo", "disponible",
  // recommendations
  "recommande", "recommander", "recommandation", "recommandations", "propose", "proposer", "propositions",
  "suggère", "suggestion", "suggestions", "similaire", "similaires", "pareil", "ressemble", "ressemblant",
  "genre", "ambiance", "envie", "cherche", "chercher", "trouve", "trouver", "autre", "autres", "nouveau",
  "nouveaux", "nouvelle", "nouvelles", "horreur", "comédie", "comédies", "animation", "animé", "animés",
  "documentaire", "thriller", "drame", "romance", "fantastique", "aventure", "policier", "guerre", "western",
  "familial", "enfants", "science-fiction",
  // what it can do / questions about titles
  "capable", "capacités", "fonctionnalités", "aider", "faire", "peux", "pouvez", "savoir", "épisode",
  "épisodes", "saison", "saisons", "série", "séries", "film", "films", "musique", "générique", "bande",
  "originale", "chanson", "acteur", "acteurs", "actrice", "actrices", "casting", "réalisateur", "réalisatrice",
  "joue", "jouent", "sortie", "sortir", "prochaine", "prochain", "suite", "terminée", "annulée", "renouvelée",
  "statut", "filmographie", "internet", "recherche",
  // teasing / insults the dialogue director reads (typos of them corrected too)
  "papy", "petite", "frappe", "bouffon", "andouille", "blaireau", "connard", "gueule", "merde", "pute", "débile",
  "nique", "mère", "fils", "enculé", "mignon", "méchant", "niveau", "champion", "gamin",
];

// Real, common words kept exactly as typed even when one letter away from a
// vocabulary word (« fils » is not a typo of « film », « faite » not of
// « faire »). They also count as ties, so a near-miss between two of them
// is left alone.
const KEEP_AS_IS = [
  "être", "avoir", "faite", "faites", "fait", "dire", "dis", "dit", "sais", "sait", "vois", "voit", "voir",
  "veux", "veut", "fois", "vrai", "vraie", "dans", "sans", "avec", "pour", "mais", "donc", "elle", "elles",
  "nous", "vous", "leur", "leurs", "même", "aussi", "très", "trop", "plus", "moins", "bonne", "jour", "soir",
  "nuit", "gens", "homme", "femme", "amie", "amis", "suis", "sont", "part", "pars", "peur", "mort", "morte",
  "mots", "lien", "faim", "rire", "cool", "super", "nulle", "fille", "file", "jeux", "voix", "loin", "près",
  "gars", "chose", "truc", "trucs", "parle", "parler", "parles", "sale", "salle", "seul", "seule", "vite",
  "quoi", "faut", "avait", "était", "sera", "serait", "pense", "penses", "crois", "aime", "aimes", "adore",
  "adores", "déteste", "putain", "merci", "salut", "bonjour", "bonsoir", "coucou", "genre", "mode", "code",
  "série", "vie", "rien", "tout", "tous", "toute", "toutes", "bien", "fin", "film", "filme", "filmé", "ville",
  "vide", "suite", "suit", "suivre", "joue", "jeu", "roi", "reine", "boss", "chef", "sire", "prince", "lord",
  "king", "queen", "daddy", "papa", "maman", "maison", "mois", "moins", "mec", "meuf", "pote", "potes",
];

const strip = (word: string) => word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const collapse = (word: string) => word.replace(/(.)\1+/g, "$1");

const CANONICAL = new Map<string, string>();
for (const word of [...VOCABULARY, ...KEEP_AS_IS]) if (!CANONICAL.has(strip(word))) CANONICAL.set(strip(word), word);
const DETECTOR_WORDS = new Set(VOCABULARY.map(strip));
const ENTRIES = [...CANONICAL.entries()];

/** Damerau-Levenshtein (adjacent transposition = 1), stopped early past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

function correctWord(word: string): string {
  const plain = strip(word);
  if (plain.length < 4) return word;
  // Correct already, or only missing its accents: the canonical spelling.
  const exact = CANONICAL.get(plain);
  if (exact) return plain === strip(exact) && word !== exact && /[^a-z-]/i.test(exact) ? exact : word;
  // « apelle » / « appelle », « recomande » / « recommande »: doubled letters.
  const collapsed = collapse(plain);
  const byDoubles = ENTRIES.filter(([key]) => collapse(key) === collapsed);
  if (byDoubles.length === 1) return byDoubles[0][1];
  const max = plain.length >= 8 ? 2 : 1;
  // Closest word; at equal distance a detector word beats a merely common
  // one (« flim » → « film », not « faim »). Two detector words as close
  // (or two common ones) is ambiguous: left as typed, like anything too far.
  let best: { canonical: string; dist: number; detector: boolean } | null = null;
  let tie = false;
  for (const [key, canonical] of ENTRIES) {
    const dist = distance(plain, key, max);
    if (dist > max) continue;
    const detector = DETECTOR_WORDS.has(key);
    if (!best || dist < best.dist || (dist === best.dist && detector && !best.detector)) {
      best = { canonical, dist, detector };
      tie = false;
    } else if (dist === best.dist && detector === best.detector) tie = true;
  }
  return best && !tie ? best.canonical : word;
}

/** The message with every near-miss of the detectors' vocabulary corrected;
 *  anything else (titles, names, slang) left exactly as typed. */
export function correctTypos(message: string): string {
  return message.replace(/[\p{L}]+(?:-[\p{L}]+)*/gu, (token) => {
    // Hyphenated forms (« appelle-moi », « soumets-toi ») word by word.
    return token.split("-").map(correctWord).join("-");
  });
}

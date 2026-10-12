/** Accent/case/punctuation-insensitive form used to compare a typed search
 *  with a TMDb title ("Un bon avocat" ≈ "un-bon avocat !"). */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when one of the titles is what the user typed (one contains the
 *  other). Used by the text search to keep a title TMDb has no votes for
 *  yet (festival film, French release to come): hiding it as "junk" made a
 *  film searched by its exact name unfindable. */
export function titleMatchesQuery(titles: Array<string | null | undefined>, query: string): boolean {
  const q = normalize(query);
  if (!q) return false;
  return titles.some((t) => {
    const n = t ? normalize(t) : "";
    if (!n) return false;
    return n.includes(q) || (n.length >= 3 && q.includes(n));
  });
}

import type { LibraryEpisode, LibraryFile, LibrarySeason } from "./types";

/**
 * Pure planner behind « Resynchroniser avec TVDB ». No I/O: the caller hands
 * it both catalogues, the library as it is and every physical file it could
 * find, and gets back the new seasons plus the duplicate files to discard.
 *
 * Why it exists: a library usually holds files in TWO numberings at once —
 * old grabs follow TMDb (one flat 50-episode season), later ones follow TVDB
 * (arcs as seasons). The previous resync trusted the folder names, merged
 * both numberings under the same season number and ended up with every
 * episode past TVDB's first season listed twice (Blood+, Dragon Ball GT,
 * Dragon Ball Super, Yu-Gi-Oh! GX…), while silently dropping every season
 * that had no folder yet, every Plex link and every monitoring choice.
 *
 * Here each file is placed on the ONE target episode it really is: its
 * filename is read in both numberings, and a TMDb coordinate is converted to
 * TVDB (or back) by matching air dates, never by position alone.
 */

export interface CatalogEpisode {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string | null;
}

export interface ResyncFile {
  /** Physical path as stored in the library (or found on disk). */
  path: string;
  /** Season/episode written in the filename itself, when it carries one. */
  literal: { seasonNumber: number; episodeNumber: number } | null;
  size: number;
  /** Ready-made library record for a disk-only file (no library episode points at it yet). */
  diskFile?: LibraryFile;
}

export interface ResyncPlanInput {
  oldSeasons: LibrarySeason[];
  tvdb: CatalogEpisode[];
  /** Null when TMDb could not be read completely — never planned from a partial list. */
  tmdb: CatalogEpisode[] | null;
  tvdbSeasonNames: Map<number, string>;
  tmdbSeasonNames: Map<number, string>;
  files: ResyncFile[];
  includeSpecials: boolean;
  isCjk: (text: string) => boolean;
  statusFor: (episodes: CatalogEpisode[]) => Map<number, "upcoming" | "missing">;
}

export interface ResyncDuplicate {
  seasonNumber: number;
  episodeNumber: number;
  keptPath: string;
  droppedPath: string;
  /** Both placements proven (literal coordinate or air-date match): safe to discard. */
  verified: boolean;
}

export interface ResyncPlan {
  ok: true;
  source: "tvdb" | "tmdb";
  seasons: LibrarySeason[];
  duplicates: ResyncDuplicate[];
  /** Files no catalogue episode could be found for: kept as extra episodes. */
  extras: string[];
  movedFiles: number;
}

export type ResyncPlanResult = ResyncPlan | { ok: false; error: "no_catalog" | "combined_files" };

const DAY_MS = 86_400_000;
const keyOf = (s: number, e: number) => `${s}-${e}`;
const bySeasonEpisode = (a: { seasonNumber: number; episodeNumber: number }, b: { seasonNumber: number; episodeNumber: number }) =>
  a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber;

function dayOf(date: string | null): number | null {
  if (!date) return null;
  const t = Date.parse(date.slice(0, 10));
  return Number.isFinite(t) ? Math.round(t / DAY_MS) : null;
}

function datesAgree(a: string | null, b: string | null, toleranceDays = 2): boolean | null {
  const da = dayOf(a), db = dayOf(b);
  if (da == null || db == null) return null;
  return Math.abs(da - db) <= toleranceDays;
}

interface Mapped { key: string; verified: boolean }

/**
 * Regular-season (S≥1) correspondence from one numbering to the other.
 * 1. The k-th episode aired on a given day maps to the k-th one of the other
 *    catalogue on that day (±1 day for time-zone shifts), in broadcast
 *    order — verified.
 * 2. A run of episodes left without a date match, sitting between two
 *    matched ones (or a catalogue end), is filled in order when the other
 *    side has exactly as many free episodes there — verified too: both
 *    lists agree on everything around it, only a date is off. Otherwise its
 *    episodes follow position only where dates don't contradict, unverified.
 */
export function alignCatalogs(from: CatalogEpisode[], to: CatalogEpisode[]): Map<string, Mapped> {
  const a = from.filter((e) => e.seasonNumber > 0).sort(bySeasonEpisode);
  const b = to.filter((e) => e.seasonNumber > 0).sort(bySeasonEpisode);
  const byDay = new Map<number, number[]>();
  b.forEach((e, i) => {
    const d = dayOf(e.airDate);
    if (d == null) return;
    byDay.set(d, [...(byDay.get(d) ?? []), i]);
  });
  const target: Array<{ j: number; verified: boolean } | null> = a.map(() => null);
  const used = new Set<number>();
  const rankOnDay = new Map<number, number>();
  let last = -1;

  a.forEach((e, i) => {
    const d = dayOf(e.airDate);
    if (d == null) return;
    const rank = rankOnDay.get(d) ?? 0;
    rankOnDay.set(d, rank + 1);
    for (const day of [d, d - 1, d + 1]) {
      const list = byDay.get(day) ?? [];
      const candidate = day === d ? list[rank] : list.find((j) => !used.has(j) && j > last);
      if (candidate != null && !used.has(candidate) && candidate > last) {
        target[i] = { j: candidate, verified: true };
        used.add(candidate);
        last = candidate;
        return;
      }
    }
  });

  for (let i = 0; i < a.length; i++) {
    if (target[i]) continue;
    let end = i;
    while (end + 1 < a.length && !target[end + 1]) end++;
    const lo = i > 0 ? target[i - 1]!.j : -1;
    const hi = end + 1 < a.length ? target[end + 1]!.j : b.length;
    const free: number[] = [];
    for (let j = lo + 1; j < hi; j++) if (!used.has(j)) free.push(j);
    const run = end - i + 1;
    for (let k = 0; k < Math.min(run, free.length); k++) {
      const j = free[k];
      const agree = datesAgree(a[i + k].airDate, b[j].airDate, 7);
      if (free.length === run || agree !== false) {
        target[i + k] = { j, verified: free.length === run };
        used.add(j);
      }
    }
    i = end;
  }

  const result = new Map<string, Mapped>();
  a.forEach((e, i) => {
    const t = target[i];
    if (t) result.set(keyOf(e.seasonNumber, e.episodeNumber), { key: keyOf(b[t.j].seasonNumber, b[t.j].episodeNumber), verified: t.verified });
  });
  return result;
}

function realSeasonCount(list: CatalogEpisode[]): number {
  return new Set(list.filter((e) => e.seasonNumber > 0).map((e) => e.seasonNumber)).size;
}

/**
 * Structure kept as is; TVDB titles and dates refresh the episodes it holds
 * at the same coordinate — only when the air dates don't contradict it, so
 * a TVDB episode that is another one under the same number is never copied.
 * A file found on disk that no episode links yet fills the empty episode
 * it is: its own number, or its TVDB number converted by air date.
 */
function patchTitlesOnly(oldSeasons: LibrarySeason[], tvdb: CatalogEpisode[], tmdb: CatalogEpisode[], files: ResyncFile[], isCjk: (t: string) => boolean): ResyncPlan {
  const byKey = new Map(tvdb.map((e) => [keyOf(e.seasonNumber, e.episodeNumber), e]));
  const toTmdb = tvdb.length > 0 ? alignCatalogs(tvdb, tmdb) : new Map<string, Mapped>();
  const slots = new Map<string, ResyncFile>();
  const empty = new Set(oldSeasons.flatMap((s) => s.episodes.filter((e) => !e.file).map((e) => keyOf(s.seasonNumber, e.episodeNumber))));
  for (const f of files) {
    if (!f.diskFile || !f.literal) continue;
    const literal = keyOf(f.literal.seasonNumber, f.literal.episodeNumber);
    const mapped = byKey.has(literal) ? toTmdb.get(literal) : undefined;
    const key = empty.has(literal) ? literal : mapped?.verified && empty.has(mapped.key) ? mapped.key : null;
    if (key && !slots.has(key)) slots.set(key, f);
  }
  const seasons = oldSeasons.map((s) => ({
    ...s,
    episodes: s.episodes.map((e) => {
      const found = slots.get(keyOf(s.seasonNumber, e.episodeNumber));
      if (found) e = { ...e, status: "available" as const, file: found.diskFile! };
      const match = byKey.get(keyOf(s.seasonNumber, e.episodeNumber));
      if (!match || datesAgree(e.airDate, match.airDate) === false) return e;
      const keepTitle = e.title && !isCjk(e.title);
      return {
        ...e,
        title: keepTitle || !match.title || isCjk(match.title) ? e.title : match.title,
        airDate: match.airDate ?? e.airDate,
      };
    }),
  }));
  return { ok: true, source: "tmdb", seasons, duplicates: [], extras: [], movedFiles: 0 };
}

export function planAnimeResync(input: ResyncPlanInput): ResyncPlanResult {
  const { oldSeasons, tmdb, includeSpecials } = input;
  // TVDB files a whole franchise under one entry (Saint Seiya 1986 holds
  // Hades, The Lost Canvas, Omega… as seasons 4–12) where TMDb, and the
  // library, keep separate series. A TVDB season starting more than six
  // months after TMDb's very last listed episode is one of those other
  // shows: importing it would duplicate them and send the missing-episode
  // search after series the library already tracks elsewhere.
  const tmdbLastDay = Math.max(-Infinity, ...(tmdb ?? []).filter((e) => e.seasonNumber > 0).flatMap((e) => { const d = dayOf(e.airDate); return d == null ? [] : [d]; }));
  const foreignSeasons = new Set<number>();
  if (Number.isFinite(tmdbLastDay)) {
    for (const n of new Set(input.tvdb.map((e) => e.seasonNumber))) {
      if (n === 0) continue;
      const first = Math.min(...input.tvdb.filter((e) => e.seasonNumber === n).map((e) => dayOf(e.airDate) ?? Infinity));
      if (Number.isFinite(first) && first > tmdbLastDay + 180) foreignSeasons.add(n);
    }
  }
  const tvdb = input.tvdb.filter((e) => !foreignSeasons.has(e.seasonNumber));
  // Which structure the library should end up in:
  //  - TVDB when it splits the show finer than TMDb (the point of the button);
  //  - TVDB too when the library already follows it exactly (an earlier
  //    resync) — its files and Plex numbering match it, nothing to undo;
  //  - otherwise TMDb, rebuilt ONLY when the library is visibly broken
  //    (more episodes than either catalogue has: duplicated numberings, a
  //    structure borrowed from another show). A healthy TMDb library just
  //    gets its titles refreshed — re-deriving it from today's TMDb would
  //    shuffle files whenever TMDb renumbered an old show.
  const real = <T extends { seasonNumber: number }>(list: T[]) => list.filter((e) => e.seasonNumber > 0);
  const oldReal = real(oldSeasons.flatMap((s) => s.episodes.map((e) => ({ ...e, seasonNumber: s.seasonNumber }))));
  const tvdbKeys = new Set(real(tvdb).map((e) => keyOf(e.seasonNumber, e.episodeNumber)));
  const granular = tvdb.length > 0 && (tmdb == null || realSeasonCount(tvdb) > realSeasonCount(tmdb));
  const inTvdbLayout = tvdbKeys.size > 0 && oldReal.length > 0 && oldReal.every((e) => tvdbKeys.has(keyOf(e.seasonNumber, e.episodeNumber)));
  const useTvdb = granular || inTvdbLayout;
  if (!useTvdb && (tmdb == null || tmdb.length === 0)) return { ok: false, error: "no_catalog" };
  if (!useTvdb && oldReal.length > 0 && oldReal.length <= Math.max(real(tmdb!).length, tvdbKeys.size)) {
    return patchTitlesOnly(oldSeasons, tvdb, tmdb!, input.files, input.isCjk);
  }
  const source = useTvdb ? "tvdb" : "tmdb";
  const primary = (useTvdb ? tvdb : tmdb!).filter((e) => includeSpecials || e.seasonNumber !== 0).sort(bySeasonEpisode);
  const other = useTvdb ? tmdb : tvdb.length > 0 ? tvdb : null;
  const toTarget = other ? alignCatalogs(other, primary) : new Map<string, Mapped>();
  // TMDb announces new seasons before TVDB lists them. A TMDb season none of
  // whose episodes TVDB holds yet, airing after everything TVDB lists, is
  // such an announcement: it follows TVDB's last season (TMDb's « S2 » of a
  // show TVDB splits in four is the fifth) — dropping it hid upcoming
  // seasons from the fiche.
  const lastPrimarySeason = Math.max(0, ...primary.map((e) => e.seasonNumber));
  const lastPrimaryDay = Math.max(-Infinity, ...primary.flatMap((e) => { const d = dayOf(e.airDate); return d == null ? [] : [d]; }));
  const announced: CatalogEpisode[] = [];
  const announcedNames = new Map<number, string>();
  if (useTvdb && tmdb) {
    let next = lastPrimarySeason;
    for (const n of [...new Set(tmdb.map((e) => e.seasonNumber))].filter((n) => n > 0).sort((a, b) => a - b)) {
      const eps = tmdb.filter((e) => e.seasonNumber === n);
      const ahead = eps.every((e) => !toTarget.has(keyOf(n, e.episodeNumber)) && (dayOf(e.airDate) ?? Infinity) > lastPrimaryDay);
      if (!ahead) continue;
      next++;
      const name = input.tmdbSeasonNames.get(n);
      if (name) announcedNames.set(next, name);
      for (const e of eps) {
        announced.push({ ...e, seasonNumber: next });
        toTarget.set(keyOf(n, e.episodeNumber), { key: keyOf(next, e.episodeNumber), verified: true });
      }
    }
  }
  const catalog = [...primary, ...announced].sort(bySeasonEpisode);
  // TMDb's coordinate of each TVDB episode (proven matches only): what lets
  // every client show the right TMDb still and synopsis for a TVDB number.
  const tmdbOf = new Map<string, { seasonNumber: number; episodeNumber: number }>();
  if (useTvdb && tmdb) {
    for (const [from, to] of toTarget) {
      if (!to.verified) continue;
      const [s, e] = from.split("-").map(Number);
      tmdbOf.set(to.key, { seasonNumber: s, episodeNumber: e });
    }
  }
  const catalogByKey = new Map(catalog.map((e) => [keyOf(e.seasonNumber, e.episodeNumber), e]));
  const otherKeys = new Set((other ?? []).map((e) => keyOf(e.seasonNumber, e.episodeNumber)));

  const oldEpisodes = oldSeasons.flatMap((s) => s.episodes.map((e) => ({ ...e, seasonNumber: s.seasonNumber })));
  const physical = (f: LibraryFile | null | undefined) => f?.diskPath ?? f?.path ?? null;

  // ---- 1. Where can each file go? ----
  type Placement = Mapped & { literalMatch: boolean };
  const placementsOf = (file: ResyncFile): Placement[] => {
    const owners = oldEpisodes.filter((e) => physical(e.file) === file.path || e.file?.path === file.path);
    const coords = file.literal ? [file.literal] : owners.map((o) => ({ seasonNumber: o.seasonNumber, episodeNumber: o.episodeNumber }));
    const out = new Map<string, Placement>();
    for (const c of coords) {
      const k = keyOf(c.seasonNumber, c.episodeNumber);
      if (catalogByKey.has(k)) out.set(k, { key: k, verified: true, literalMatch: true });
      const mapped = otherKeys.has(k) ? toTarget.get(k) : undefined;
      if (mapped && catalogByKey.has(mapped.key) && !out.has(mapped.key)) out.set(mapped.key, { ...mapped, literalMatch: false });
    }
    // TVDB renumbers too (an episode moved from one arc to the next): a file
    // named after the OLD TVDB number then points at the wrong episode. The
    // one library record that owns it knows which broadcast it is — the
    // catalogue episode aired that very day is a candidate as well.
    if (owners.length === 1 && owners[0].airDate) {
      const sameDay = catalog.filter((c) => (c.seasonNumber > 0) === (owners[0].seasonNumber > 0) && datesAgree(owners[0].airDate, c.airDate, 0) === true);
      if (sameDay.length === 1) {
        const k = keyOf(sameDay[0].seasonNumber, sameDay[0].episodeNumber);
        if (!out.has(k)) out.set(k, { key: k, verified: true, literalMatch: false });
      }
    }
    let list = [...out.values()];
    if (list.length > 1) {
      // Same number means two different episodes depending on the
      // numbering: the library record that already owns the file, aired
      // on a given day, says which one it is.
      const byOwnerDate = list.filter((p) => owners.some((o) => datesAgree(o.airDate, catalogByKey.get(p.key)!.airDate) === true));
      if (byOwnerDate.length === 1) list = byOwnerDate;
    }
    return list;
  };

  const dirOf = (p: string) => p.replace(/[\\/][^\\/]*$/, "");
  const raw = input.files.map((file) => ({ file, options: placementsOf(file) }));
  // Folder vote: a folder is written in a single numbering, so its
  // unambiguous files settle the ambiguous ones next to them.
  const votes = new Map<string, { literal: number; mapped: number }>();
  for (const r of raw) {
    if (r.options.length !== 1) continue;
    const v = votes.get(dirOf(r.file.path)) ?? { literal: 0, mapped: 0 };
    if (r.options[0].literalMatch) v.literal++; else v.mapped++;
    votes.set(dirOf(r.file.path), v);
  }
  const chosen = new Map<string, Array<{ file: ResyncFile; placement: Placement }>>();
  const extras: ResyncFile[] = [];
  for (const r of raw) {
    let placement = r.options[0];
    if (r.options.length > 1) {
      const v = votes.get(dirOf(r.file.path));
      const preferLiteral = !v || v.literal >= v.mapped;
      placement = r.options.find((o) => o.literalMatch === preferLiteral) ?? r.options[0];
    }
    if (!placement) { extras.push(r.file); continue; }
    chosen.set(placement.key, [...(chosen.get(placement.key) ?? []), { file: r.file, placement }]);
  }

  // ---- 2. One file per episode; the rest are duplicates ----
  const duplicates: ResyncDuplicate[] = [];
  const fileFor = new Map<string, ResyncFile>();
  for (const [key, list] of chosen) {
    const ownerAt = (f: ResyncFile) => oldEpisodes.some((o) => keyOf(o.seasonNumber, o.episodeNumber) === key && (physical(o.file) === f.path || o.file?.path === f.path));
    const ranked = [...list].sort((x, y) =>
      Number(y.placement.literalMatch) - Number(x.placement.literalMatch)
      || Number(ownerAt(y.file)) - Number(ownerAt(x.file))
      || y.file.size - x.file.size);
    const keep = ranked[0];
    fileFor.set(key, keep.file);
    const cat = catalogByKey.get(key)!;
    for (const drop of ranked.slice(1)) {
      if (drop.file.path === keep.file.path) continue;
      duplicates.push({
        seasonNumber: cat.seasonNumber, episodeNumber: cat.episodeNumber,
        keptPath: keep.file.path, droppedPath: drop.file.path,
        verified: keep.placement.verified && drop.placement.verified,
      });
    }
  }

  // ---- 3. Which old record carries each target episode's state? ----
  const sameEpisode = (o: LibraryEpisode, c: CatalogEpisode) => {
    const agree = datesAgree(o.airDate, c.airDate);
    return agree ?? (o.seasonNumber === c.seasonNumber && o.episodeNumber === c.episodeNumber);
  };
  const oldByKey = new Map(oldEpisodes.map((o) => [keyOf(o.seasonNumber, o.episodeNumber), o]));
  const identityFor = (c: CatalogEpisode): LibraryEpisode | null => {
    const at = oldByKey.get(keyOf(c.seasonNumber, c.episodeNumber));
    if (at && sameEpisode(at, c)) return at;
    if (!c.airDate) return null;
    const sameDay = oldEpisodes.filter((o) => o.seasonNumber > 0 === c.seasonNumber > 0 && datesAgree(o.airDate, c.airDate, 0) === true);
    return sameDay.length === 1 ? sameDay[0] : null;
  };

  const titleFor = (c: CatalogEpisode, base: LibraryEpisode | null) => {
    if (base?.title && !input.isCjk(base.title) && sameEpisode(base, c)) return base.title;
    if (c.title && !input.isCjk(c.title)) return c.title;
    return `Épisode ${c.episodeNumber}`;
  };

  // ---- 4. Build the seasons ----
  const seasonsOut = new Map<number, LibraryEpisode[]>();
  const catalogSeasons = new Map<number, CatalogEpisode[]>();
  for (const c of catalog) catalogSeasons.set(c.seasonNumber, [...(catalogSeasons.get(c.seasonNumber) ?? []), c]);
  let movedFiles = 0;
  let blocked = false;

  for (const [seasonNumber, eps] of catalogSeasons) {
    const statuses = input.statusFor(eps);
    const out: LibraryEpisode[] = [];
    for (const c of eps) {
      const key = keyOf(c.seasonNumber, c.episodeNumber);
      const file = fileFor.get(key);
      const owners = file ? oldEpisodes.filter((o) => physical(o.file) === file.path || o.file?.path === file.path) : [];
      const owner = owners.find((o) => keyOf(o.seasonNumber, o.episodeNumber) === key)
        ?? owners.find((o) => sameEpisode(o, c))
        ?? owners[0]
        ?? null;
      const identity = identityFor(c);
      const base = owner ?? identity;
      if (owner && keyOf(owner.seasonNumber, owner.episodeNumber) !== key) {
        movedFiles++;
        if (owner.combinedFile) blocked = true;
      }
      const monitored = identity?.monitored ?? owner?.monitored ?? c.seasonNumber !== 0;
      if (file) {
        out.push({
          ...(base ?? {}),
          seasonNumber: c.seasonNumber,
          episodeNumber: c.episodeNumber,
          title: titleFor(c, base),
          airDate: c.airDate ?? base?.airDate ?? null,
          monitored,
          status: "available",
          file: owner?.file ?? file.diskFile ?? null,
          activeInfoHash: null,
          plexRatingKey: owner?.plexRatingKey ?? null,
          playbackSource: owner?.playbackSource ?? null,
          ...(owner?.combinedFile && keyOf(owner.seasonNumber, owner.episodeNumber) === key ? { combinedFile: owner.combinedFile } : { combinedFile: undefined }),
          tmdbCoordinate: tmdbOf.get(key) ?? null,
        });
      } else {
        out.push({
          ...(identity ?? {}),
          seasonNumber: c.seasonNumber,
          episodeNumber: c.episodeNumber,
          title: titleFor(c, identity),
          airDate: c.airDate ?? identity?.airDate ?? null,
          monitored,
          status: statuses.get(c.episodeNumber) ?? "missing",
          file: null,
          activeInfoHash: null,
          plexRatingKey: null,
          playbackSource: null,
          plexLinkStatus: undefined,
          combinedFile: undefined,
          tmdbCoordinate: tmdbOf.get(key) ?? null,
        });
      }
    }
    seasonsOut.set(seasonNumber, out);
  }
  if (blocked) return { ok: false, error: "combined_files" };

  // Specials switched off means « never add a season 0 », not « delete the
  // one the library already has »: it stays exactly as it was.
  const oldSpecials = oldSeasons.find((x) => x.seasonNumber === 0);
  if (!includeSpecials && oldSpecials && !seasonsOut.has(0)) seasonsOut.set(0, oldSpecials.episodes.map((e) => ({ ...e, seasonNumber: 0 })));

  // Files no catalogue entry fits are never unlinked: they stay visible as
  // extra episodes at the number their filename gives, when that slot is free.
  const extraPaths: string[] = [];
  for (const f of extras) {
    const owner = oldEpisodes.find((o) => physical(o.file) === f.path || o.file?.path === f.path);
    const at = f.literal ?? (owner ? { seasonNumber: owner.seasonNumber, episodeNumber: owner.episodeNumber } : null);
    if (!at || (at.seasonNumber === 0 && !includeSpecials)) continue;
    const list = seasonsOut.get(at.seasonNumber) ?? [];
    if (list.some((e) => e.episodeNumber === at.episodeNumber)) continue;
    list.push({
      ...(owner ?? {}),
      seasonNumber: at.seasonNumber,
      episodeNumber: at.episodeNumber,
      title: owner?.title && !input.isCjk(owner.title) ? owner.title : `Épisode ${at.episodeNumber}`,
      airDate: owner?.airDate ?? null,
      monitored: owner?.monitored ?? true,
      status: "available",
      file: owner?.file ?? f.diskFile ?? null,
      activeInfoHash: null,
      plexRatingKey: owner?.plexRatingKey ?? null,
    });
    seasonsOut.set(at.seasonNumber, list);
    extraPaths.push(f.path);
  }

  const names = useTvdb ? input.tvdbSeasonNames : input.tmdbSeasonNames;
  const seasons: LibrarySeason[] = [...seasonsOut.entries()]
    .sort(([a], [b]) => a - b)
    .map(([seasonNumber, episodes]) => {
      const old = oldSeasons.find((s) => s.seasonNumber === seasonNumber);
      return {
        ...(old ?? {}),
        seasonNumber,
        name: names.get(seasonNumber) ?? announcedNames.get(seasonNumber) ?? old?.name ?? (seasonNumber === 0 ? "Épisodes spéciaux" : `Saison ${seasonNumber}`),
        monitored: old?.monitored ?? seasonNumber !== 0,
        episodes: episodes.sort((a, b) => a.episodeNumber - b.episodeNumber),
      };
    });

  return { ok: true, source, seasons, duplicates, extras: extraPaths, movedFiles };
}

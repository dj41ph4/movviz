import type { LibraryFile, LibraryFileVersion } from "./types";

/**
 * Single point of truth for reading/writing multi-version media. Operates
 * on a generic `{ file, versions? }` shape — not `LibraryMovie` specifically
 * — so LOT8 can reuse it for `LibraryEpisode` later without a rewrite.
 *
 * `file` always mirrors whichever version has `primary: true`. Every
 * existing call site that only ever read `movie.file` keeps working
 * unmodified; only code that ADDS a version or changes which one is
 * primary should go through the functions here instead of hand-patching
 * `{ file: {...} }`.
 */
export interface VersionedMedia {
  file: LibraryFile | null;
  versions?: LibraryFileVersion[];
}

let seq = 0;
function makeVersionId(): string {
  seq += 1;
  return `ver_${Date.now().toString(36)}_${seq}`;
}

/** Strips the version-only fields (id/versionSource/reason/primary) back down to a plain LibraryFile. */
function toLibraryFile(v: LibraryFileVersion): LibraryFile {
  const { id: _id, versionSource: _versionSource, reason: _reason, primary: _primary, ...file } = v;
  return file;
}

export function getPrimaryFile<T extends VersionedMedia>(media: T): LibraryFile | null {
  const primary = media.versions?.find((v) => v.primary);
  return primary ? toLibraryFile(primary) : media.file;
}

/**
 * Replaces the primary version in place — the normal `first_acquisition`/
 * `quality_upgrade` write path. If `versions[]` already exists, the old
 * primary entry is updated (not removed) so its history/badges survive;
 * a media item with no `versions[]` yet just gets `file` replaced as before.
 */
export function setPrimaryFile<T extends VersionedMedia>(
  media: T,
  file: LibraryFile,
  meta: { versionSource: string; reason: string }
): T {
  if (!media.versions || media.versions.length === 0) {
    return { ...media, file };
  }
  const versions = media.versions.map((v) =>
    v.primary ? { ...v, ...file, versionSource: meta.versionSource, reason: meta.reason, primary: true } : v
  );
  return { ...media, file, versions };
}

/** Adds a new version — never removes the existing one(s). Defaults to non-primary unless explicitly asked. */
export function addVersion<T extends VersionedMedia>(
  media: T,
  file: LibraryFile,
  meta: { versionSource: string; reason: string; makePrimary?: boolean }
): T {
  const newEntry: LibraryFileVersion = { ...file, id: makeVersionId(), versionSource: meta.versionSource, reason: meta.reason, primary: !!meta.makePrimary };

  const existing: LibraryFileVersion[] =
    media.versions && media.versions.length > 0
      ? media.versions
      : media.file
        ? [{ ...media.file, id: makeVersionId(), versionSource: "unknown", reason: "Acquisition initiale", primary: true }]
        : [];

  const versions = meta.makePrimary ? existing.map((v) => ({ ...v, primary: false })) : existing.slice();
  versions.push(newEntry);

  const primaryEntry = versions.find((v) => v.primary) ?? newEntry;
  return { ...media, versions, file: toLibraryFile(primaryEntry) };
}

export function removeVersion<T extends VersionedMedia>(media: T, versionId: string): T {
  if (!media.versions) return media;
  const removed = media.versions.find((v) => v.id === versionId);
  if (!removed) return media;
  const versions = media.versions.filter((v) => v.id !== versionId);

  if (!removed.primary) return { ...media, versions };

  // Removing the primary promotes the next remaining version (if any).
  if (versions.length === 0) return { ...media, versions: undefined, file: null };
  const promoted = { ...versions[0], primary: true };
  const nextVersions = [promoted, ...versions.slice(1)];
  return { ...media, versions: nextVersions, file: toLibraryFile(promoted) };
}

export function setPrimaryVersion<T extends VersionedMedia>(media: T, versionId: string): T {
  if (!media.versions) return media;
  const target = media.versions.find((v) => v.id === versionId);
  if (!target) return media;
  const versions = media.versions.map((v) => ({ ...v, primary: v.id === versionId }));
  return { ...media, versions, file: toLibraryFile({ ...target, primary: true }) };
}

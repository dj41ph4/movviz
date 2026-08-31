import fs from "node:fs/promises";
import path from "node:path";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const CACHE_DIR = path.join(CONFIG_DIR, "tmdb-artwork");

// Keep every size already emitted by the UI. The route replaces a permissive
// Next rewrite, so rejecting one of those sizes would turn an existing card
// or episode still into a 404.
const IMAGE_SIZES = new Set(["w45", "w92", "w154", "w185", "w200", "w300", "w342", "w500", "w780", "w1280", "original"]);
const IMAGE_FILE = /^[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp|svg)$/i;

const g = globalThis as typeof globalThis & { __movvizTmdbImageInFlight?: Map<string, Promise<string | null>> };
const inFlight: Map<string, Promise<string | null>> = (g.__movvizTmdbImageInFlight ??= new Map());

export type TmdbImageSize = "w45" | "w92" | "w154" | "w185" | "w200" | "w300" | "w342" | "w500" | "w780" | "w1280" | "original";
export type TmdbArtworkCachePart = "all" | "logos" | "backdrops";

function fileNameOf(value: string): string | null {
  const name = value.replace(/^\/+/, "");
  return IMAGE_FILE.test(name) ? name : null;
}

// Card artwork and detail heroes intentionally share the same high-quality
// background bytes. Requests historically mixed w780 (card) and w1280/original
// (detail), creating two or three files for the exact same TMDb path.
function canonicalSize(size: string): string {
  return size === "w780" || size === "original" ? "w1280" : size;
}

function imageFile(size: string, rawPath: string): string | null {
  const filename = fileNameOf(rawPath);
  const canonical = canonicalSize(size);
  if (!IMAGE_SIZES.has(size) || !IMAGE_SIZES.has(canonical) || !filename) return null;
  return path.join(CACHE_DIR, canonical, filename);
}

function legacyW780File(rawPath: string): string | null {
  const filename = fileNameOf(rawPath);
  return filename ? path.join(CACHE_DIR, "w780", filename) : null;
}

async function exists(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

function safeCacheTarget(file: string): boolean {
  const relative = path.relative(CACHE_DIR, file);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function removeImage(size: TmdbImageSize, rawPath: string | null): Promise<number> {
  if (!rawPath) return 0;
  const target = imageFile(size, rawPath);
  if (!target || !safeCacheTarget(target)) return 0;
  try {
    await fs.unlink(target);
    return 1;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

/**
 * Fetches a TMDb image once and stores its immutable bytes locally. Every
 * regular card request and the explicit cache warmer use this exact helper,
 * so image data is never duplicated and concurrent first views share one
 * download.
 */
async function ensureTmdbImage(size: string, rawPath: string): Promise<string | null> {
  const target = imageFile(size, rawPath);
  const filename = fileNameOf(rawPath);
  if (!target || !filename) return null;
  const sourceSize = canonicalSize(size);
  const legacy = sourceSize === "w1280" ? legacyW780File(rawPath) : null;
  const removeLegacy = async () => {
    if (!legacy || !safeCacheTarget(legacy) || legacy === target) return;
    await fs.unlink(legacy).catch(() => {});
  };
  if (await exists(target)) {
    await removeLegacy();
    return target;
  }

  const cacheKey = `${sourceSize}/${filename}`;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const download = (async () => {
    try {
      const response = await fetch(`https://image.tmdb.org/t/p/${sourceSize}/${filename}`, { cache: "no-store" });
      if (!response.ok) return null;
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length === 0) return null;
      await fs.mkdir(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, body);
      try {
        await fs.rename(tmp, target);
      } catch {
        // Another request may have completed the exact same immutable file.
        await fs.rm(tmp, { force: true }).catch(() => {});
      }
      if (await exists(target)) {
        await removeLegacy();
        return target;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, download);
  return download;
}

/** Preloads an asset for the explicit whole-library artwork cache. */
export async function prefetchTmdbImage(size: TmdbImageSize, filePath: string | null): Promise<boolean> {
  if (!filePath) return true;
  return !!(await ensureTmdbImage(size, filePath));
}

/**
 * Removes only visual bytes. The durable title -> TMDb path mapping stays in
 * title-artwork-cache.json, so the next warm pass can restore just the
 * missing asset without asking TMDb again or redownloading the other half of
 * a card.
 */
export async function clearTmdbArtworkCache(
  part: TmdbArtworkCachePart,
  entries: readonly { backdropPath: string | null; logoPath: string | null }[] = []
): Promise<{ removed: number }> {
  if (part === "all") {
    // This is intentionally narrow: only Movviz's dedicated immutable image
    // cache may ever be recursively removed.
    const resolvedCache = path.resolve(CACHE_DIR);
    const resolvedConfig = path.resolve(CONFIG_DIR);
    if (path.basename(resolvedCache) !== "tmdb-artwork" || path.dirname(resolvedCache) !== resolvedConfig) {
      throw new Error("unsafe_tmdb_artwork_cache_path");
    }
    try {
      await fs.rm(resolvedCache, { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return { removed: -1 };
  }

  const size: TmdbImageSize = part === "logos" ? "w500" : "w780";
  const paths = new Set(entries.map((entry) => part === "logos" ? entry.logoPath : entry.backdropPath).filter((value): value is string => !!value));
  let removed = 0;
  for (const filePath of paths) removed += await removeImage(size, filePath);
  return { removed };
}

export async function readTmdbImage(size: string, rawPath: string): Promise<{ body: Buffer; contentType: string } | null> {
  const file = await ensureTmdbImage(size, rawPath);
  if (!file) return null;
  const extension = path.extname(file).toLowerCase();
  const contentType = extension === ".png"
    ? "image/png"
    : extension === ".webp"
      ? "image/webp"
      : extension === ".svg"
        ? "image/svg+xml"
        : "image/jpeg";
  try {
    return { body: await fs.readFile(file), contentType };
  } catch {
    return null;
  }
}

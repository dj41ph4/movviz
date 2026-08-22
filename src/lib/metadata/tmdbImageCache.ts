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
const IMAGE_FILE = /^[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;

const g = globalThis as typeof globalThis & { __movvizTmdbImageInFlight?: Map<string, Promise<string | null>> };
const inFlight: Map<string, Promise<string | null>> = (g.__movvizTmdbImageInFlight ??= new Map());

export type TmdbImageSize = "w45" | "w92" | "w154" | "w185" | "w200" | "w300" | "w342" | "w500" | "w780" | "w1280" | "original";

function fileNameOf(value: string): string | null {
  const name = value.replace(/^\/+/, "");
  return IMAGE_FILE.test(name) ? name : null;
}

function imageFile(size: string, rawPath: string): string | null {
  const filename = fileNameOf(rawPath);
  if (!IMAGE_SIZES.has(size) || !filename) return null;
  return path.join(CACHE_DIR, size, filename);
}

async function exists(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
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
  if (await exists(target)) return target;

  const cacheKey = `${size}/${filename}`;
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const download = (async () => {
    try {
      const response = await fetch(`https://image.tmdb.org/t/p/${size}/${filename}`, { cache: "no-store" });
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
      return (await exists(target)) ? target : null;
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

export async function readTmdbImage(size: string, rawPath: string): Promise<{ body: Buffer; contentType: string } | null> {
  const file = await ensureTmdbImage(size, rawPath);
  if (!file) return null;
  const extension = path.extname(file).toLowerCase();
  const contentType = extension === ".png"
    ? "image/png"
    : extension === ".webp"
      ? "image/webp"
      : "image/jpeg";
  try {
    return { body: await fs.readFile(file), contentType };
  } catch {
    return null;
  }
}

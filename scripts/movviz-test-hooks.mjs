import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { join, resolve as pathResolve, dirname } from "node:path";

const root = pathResolve(process.cwd());

const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function resolveWithExtensions(base) {
  if (existsSync(base)) return base;
  const withExt = EXTENSIONS.map((e) => base + e).find((p) => existsSync(p));
  if (withExt) return withExt;
  const indexFile = EXTENSIONS.map((e) => join(base, "index" + e)).find((p) => existsSync(p));
  if (indexFile) return indexFile;
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (typeof specifier === "string" && specifier.startsWith("@/")) {
    const base = join(root, "src", specifier.slice(2));
    const candidate = resolveWithExtensions(base) ?? base;
    return { shortCircuit: true, url: pathToFileURL(candidate).href };
  }
  if (
    typeof specifier === "string" &&
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL
  ) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const base = pathResolve(parentDir, specifier);
    const candidate = resolveWithExtensions(base);
    if (candidate && candidate !== base) {
      return { shortCircuit: true, url: pathToFileURL(candidate).href };
    }
  }
  return nextResolve(specifier, context);
}

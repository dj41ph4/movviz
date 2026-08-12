import { pathFor } from "./renamePath";

/**
 * Number of trailing path segments that the two paths share (case‑insensitive).
 * Returns 0 when the shortest‑known non‑empty suffix is shorter than 2 — it
 * takes at least a parent folder + filename to call two paths the same file.
 */
export function commonSuffixDepth(a: string, b: string, minDepth = 2): number {
  const sep = pathFor(a).sep;
  const aParts = a.split(sep).filter(Boolean);
  const bParts = b.split(sep).filter(Boolean);
  let i = aParts.length - 1;
  let j = bParts.length - 1;
  let depth = 0;
  while (i >= 0 && j >= 0) {
    if (aParts[i].toLowerCase() !== bParts[j].toLowerCase()) break;
    depth++;
    i--;
    j--;
  }
  return depth >= minDepth ? depth : 0;
}

/**
 * Splits a path into { prefix, suffix } at `depth` trailing (non-empty)
 * segments — the counterpart to commonSuffixDepth, used to derive the
 * diverging root pair from two paths that share a known suffix depth.
 * `prefix + sep + suffix` reconstructs the original path.
 */
export function splitAtSuffixDepth(p: string, depth: number): { prefix: string; suffix: string } {
  const sep = pathFor(p).sep;
  const parts = p.split(sep);
  let count = 0;
  let idx = parts.length;
  for (let i = parts.length - 1; i >= 0; i--) {
    idx = i;
    if (parts[i] !== "") {
      count++;
      if (count === depth) break;
    }
  }
  return { prefix: parts.slice(0, idx).join(sep), suffix: parts.slice(idx).join(sep) };
}

import type { NamingContext, ReleaseInfo } from "./types";
import { TOKEN_RESOLVERS } from "./tokens";

/** Combine source + resolution into the "quality" token, e.g. "WEB-DL 1080p". */
export function buildContext(info: ReleaseInfo): NamingContext {
  const quality = [info.source, info.resolution].filter(Boolean).join(" ");
  return { ...info, quality };
}

const TOKEN_RE = /\{([a-zA-Z]+)(?::(0+))?\}/g;
// A bracket/paren pair with nothing but whitespace inside — left behind when
// the token it wrapped (e.g. "({year})") resolved to "".
const EMPTY_GROUP_RE = /[([]\s*[)\]]/g;

/** Render a template string against a context, resolving every {token}. */
export function renderTemplate(template: string, ctx: NamingContext): string {
  const rendered = template.replace(TOKEN_RE, (_match, key: string, pad?: string) => {
    const resolver = TOKEN_RESOLVERS[key];
    if (!resolver) return "";
    const value = resolver(ctx);
    if (value === null || value === undefined || value === "") return "";
    if (pad) return String(value).padStart(pad.length, "0");
    return String(value);
  });
  // Repeat once — removing "()" can leave a new empty group next to it,
  // e.g. "({year} {quality})" with both tokens empty leaves "( )" then "()".
  return rendered.replace(EMPTY_GROUP_RE, "").replace(EMPTY_GROUP_RE, "");
}

// Windows forbids these in path segments; POSIX only forbids "/" and NUL.
const WINDOWS_ILLEGAL = /[<>:"/\\|?*\x00-\x1f]/g;
const POSIX_ILLEGAL = /[/\x00]/g;

/** Sanitize ONE path segment (folder or file name) — never a full path. */
export function sanitizeSegment(segment: string, useDots = false): string {
  let s = segment.replace(process.platform === "win32" ? WINDOWS_ILLEGAL : POSIX_ILLEGAL, "");
  // In dots mode (scene-style naming), strip parens/brackets — they serve no
  // purpose when separators are dots and create ugly output like "Title.(2024)".
  if (useDots) s = s.replace(/[()[\]{}]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  // Windows disallows trailing dots/spaces on path segments.
  s = s.replace(/[. ]+$/, "");
  if (useDots) s = s.replace(/ /g, ".");
  return s || "untitled";
}

/** Render + sanitize in one call — what template editors and the engine use. */
export function renderSegment(template: string, ctx: NamingContext, useDots = false): string {
  return sanitizeSegment(renderTemplate(template, ctx), useDots);
}

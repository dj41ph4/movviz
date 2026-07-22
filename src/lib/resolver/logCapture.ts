const MAX_LINES = 500;

export interface ResolverLogLine {
  t: number;
  level: "info" | "error";
  message: string;
}

const g = globalThis as typeof globalThis & { __movvizResolverLog?: ResolverLogLine[] };
const buffer: ResolverLogLine[] = (g.__movvizResolverLog ??= []);

export function recordResolverOutput(level: "info" | "error", chunk: string) {
  for (const line of chunk.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    buffer.push({ t: Date.now(), level, message: trimmed });
  }
  while (buffer.length > MAX_LINES) buffer.shift();
}

export function getResolverLog(): ResolverLogLine[] {
  return buffer;
}

/**
 * Auto-reported client-side issues — non-critical errors (trailer playback,
 * image load failures, etc.) that should never reach the user as visible
 * crashes or error modals, but should be visible on the admin diagnostics
 * page so they don't go unnoticed.
 *
 * Also supports the public-facing per-title issue tracker
 * (api/issues/[id]/…) with statuses and admin comments.
 */

interface IssueComment {
  id: string;
  userId: string;
  username: string;
  message: string;
  createdAt: number;
}

interface Issue {
  id: string;
  userId?: string;
  message: string;
  stack?: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  status?: string;
  comments: IssueComment[];
}

let issues: Issue[] = [];

export function reportIssue(error: Error | string): void {
  const message = typeof error === "string" ? error : error.message;
  const stack = typeof error === "string" ? undefined : error.stack;
  const now = Date.now();
  const existing = issues.find((i) => i.message === message);
  if (existing) {
    existing.count++;
    existing.lastSeen = now;
  } else {
    issues.push({ id: crypto.randomUUID?.() ?? `${now}`, message, stack, count: 1, firstSeen: now, lastSeen: now, comments: [] });
  }
}

export function getIssues(): Issue[] {
  return [...issues];
}

export function getIssue(id: string): Issue | undefined {
  return issues.find((i) => i.id === id);
}

export function updateIssue(id: string, patch: Partial<Issue>): Issue | null {
  const idx = issues.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  issues[idx] = { ...issues[idx], ...patch };
  return issues[idx];
}

export function clearIssues(): void {
  issues = [];
}

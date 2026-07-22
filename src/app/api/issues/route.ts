import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadIssues, addIssue } from "@/lib/issues/store";
import { getMovie, getSeries } from "@/lib/library/store";
import type { IssueType } from "@/lib/issues/types";

export const dynamic = "force-dynamic";

const ISSUE_TYPES: IssueType[] = ["video", "audio", "subtitle", "other"];

/** Admins see every issue; regular users only see their own — same split as Requests. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const all = loadIssues();
  const issues = user.role === "admin" ? all : all.filter((i) => i.userId === user.id);
  return NextResponse.json({ issues, isAdmin: user.role === "admin" });
}

/** Report a problem on a library item already available to watch. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const libraryType = body.libraryType === "series" ? "series" : "movie";
  const libraryId = String(body.libraryId ?? "");
  const issueType: IssueType = ISSUE_TYPES.includes(body.issueType) ? body.issueType : "other";
  const description = String(body.description ?? "").trim();
  if (!libraryId || !description) {
    return NextResponse.json({ error: "libraryId and description required" }, { status: 400 });
  }

  const item = libraryType === "movie" ? getMovie(libraryId) : getSeries(libraryId);
  if (!item) return NextResponse.json({ error: "library item not found" }, { status: 404 });

  const now = Date.now();
  const issue = addIssue({
    id: `iss_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    userId: user.id,
    username: user.username,
    libraryType,
    libraryId,
    title: item.title,
    posterPath: item.posterPath,
    issueType,
    description,
    status: "open",
    comments: [],
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json(issue, { status: 201 });
}

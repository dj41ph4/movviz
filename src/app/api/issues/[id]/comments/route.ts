import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getIssue, updateIssue } from "@/lib/issues/store";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** The reporter and admins can discuss an issue — anyone else stays out of it. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const issue = getIssue((await params).id);
  if (!issue) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (user.role !== "admin" && user.id !== issue.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  const comment = {
    id: `cmt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    userId: user.id,
    username: user.username,
    message,
    createdAt: Date.now(),
  };
  const updated = updateIssue(issue.id, { comments: [...issue.comments, comment] });
  return NextResponse.json(updated, { status: 201 });
}

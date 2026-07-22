import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getIssue, updateIssue } from "@/lib/issues/store";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Admins resolve; the reporter (or an admin) can reopen a resolved issue. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const issue = getIssue((await params).id);
  if (!issue) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const status = body.status;
  if (status === "resolved") {
    if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } else if (status === "reopened") {
    if (user.role !== "admin" && user.id !== issue.userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const updated = updateIssue(issue.id, { status });
  return NextResponse.json(updated);
}

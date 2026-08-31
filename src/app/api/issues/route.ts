import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { reportIssue, getIssues, clearIssues } from "@/lib/issues/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ issues: [] });
  return NextResponse.json({ issues: getIssues() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    reportIssue(body.error ?? "Unknown client issue");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

export async function DELETE(req: NextRequest) {
  const user = requireUser(req);
  if (!user || user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  clearIssues();
  return NextResponse.json({ ok: true });
}

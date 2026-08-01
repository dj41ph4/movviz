import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { ignoreUpgrade } from "@/lib/library/ignoredUpgrades";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ movieId: string }> }) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { movieId } = await params;
  ignoreUpgrade(movieId);
  return NextResponse.json({ ok: true });
}

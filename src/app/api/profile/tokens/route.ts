import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadTokens, createToken, revokeToken } from "@/lib/tokens/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tokens = loadTokens(user.id).map(({ tokenHash: _tokenHash, ...rest }) => rest);
  return NextResponse.json({ tokens });
}

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const name = String(body.name ?? "").trim() || "Token";
  const { token, record } = createToken(user.id, name);
  const { tokenHash: _tokenHash, ...rest } = record;
  return NextResponse.json({ token, record: rest }, { status: 201 });
}

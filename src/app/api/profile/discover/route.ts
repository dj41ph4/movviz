import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { updateUser } from "@/lib/auth/store";
import { CONTINENTS } from "@/lib/metadata/continents";

export const dynamic = "force-dynamic";

const VALID_IDS = new Set(CONTINENTS.map((c) => c.id));

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const continents = Array.isArray(body.continents) ? body.continents.filter((c: unknown) => typeof c === "string" && VALID_IDS.has(c)) : [];

  updateUser(user.id, { discoverContinents: continents });
  return NextResponse.json({ ok: true, continents });
}

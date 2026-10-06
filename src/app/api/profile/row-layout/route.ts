import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getUserById, updateUser } from "@/lib/auth/store";
import { sanitizeRowLayout } from "@/lib/rowLayout";

export const dynamic = "force-dynamic";

const PAGE_ID = /^[a-z0-9:_-]{1,40}$/i;

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ layouts: getUserById(user.id)?.rowLayouts ?? {} });
}

/** Enregistre l'organisation d'une page. Corps `{ page, order, hidden }` ; `order` et `hidden` vides = retour au défaut. */
export async function PUT(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const page = typeof body?.page === "string" ? body.page : "";
  const layout = sanitizeRowLayout(body);
  if (!PAGE_ID.test(page) || !layout) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const current = getUserById(user.id)?.rowLayouts ?? {};
  const next = { ...current };
  if (layout.order.length === 0 && layout.hidden.length === 0) delete next[page];
  else next[page] = layout;
  updateUser(user.id, { rowLayouts: next });
  return NextResponse.json({ layouts: next });
}

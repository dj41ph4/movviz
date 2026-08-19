import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getUserById } from "@/lib/auth/store";
import { listTvProfiles, upsertTvProfile, removeTvProfile } from "@/lib/tvProfiles";

export const dynamic = "force-dynamic";

/**
 * Profils de foyer Android TV (Netflix-style), encrés dans le serveur.
 *
 * TOUTES les opérations sont ADMIN ONLY : le foyer est la liste que
 * l'admin constitue lui-même. Un compte invité (user) qui se connecte
 * depuis un APK ne voit jamais la liste et ne peut rien y ajouter — son
 * utilisation sur un appareil extérieur ne pollue pas le foyer de l'admin.
 *
 * - GET    : liste du foyer (triée par dernière utilisation).
 * - POST   : { userId } — ajoute/raffraîchit un compte existant dans le
 *            foyer (le compte cible doit être approuvé ; l'admin n'a pas
 *            besoin de son mot de passe, juste de choisir le compte).
 * - DELETE : { userId } — retire un compte du foyer (le compte reste intact).
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ profiles: listTvProfiles() });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const userId = String(body?.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "user_required" }, { status: 400 });

  const target = getUserById(userId);
  if (!target || target.status === "pending") {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const profile = upsertTvProfile(target);
  return NextResponse.json({ profile }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const userId = String(body?.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "user_required" }, { status: 400 });

  removeTvProfile(userId);
  return NextResponse.json({ ok: true });
}
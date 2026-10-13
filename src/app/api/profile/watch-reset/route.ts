import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getWatchResetStatus, startWatchReset, WATCH_RESET_CONFIRM_WORD } from "@/lib/watch/watchReset";

export const dynamic = "force-dynamic";

/** État du dernier « Effacer la lecture » de CE profil (effacement Plex
 *  en cours, terminé, partiel ou impossible). */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ reset: getWatchResetStatus(user.id) });
}

/** « Effacer la lecture » : toujours le profil connecté, jamais un autre
 *  (aucun identifiant de profil n'est accepté dans la requête). */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.status === "pending") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  // Le mot de la 2e confirmation est revérifié ici : un appel isolé (double
  // clic, script, ancien client) ne peut pas tout effacer par erreur.
  if (typeof body?.confirm !== "string" || body.confirm.trim().toUpperCase() !== WATCH_RESET_CONFIRM_WORD) {
    return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  }
  try {
    const result = startWatchReset(user);
    return NextResponse.json({ ok: true, resetAt: result.resetAt, cleared: result.cleared, plex: result.plex });
  } catch (error) {
    if (error instanceof Error && error.message === "already_running") {
      return NextResponse.json({ error: "already_running" }, { status: 409 });
    }
    return NextResponse.json({ error: "reset_failed" }, { status: 500 });
  }
}

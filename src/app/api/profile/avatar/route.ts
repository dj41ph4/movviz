import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { updateUser } from "@/lib/auth/store";
import { saveAvatar, deleteAvatar, AVATAR_MAX_BYTES } from "@/lib/avatars";
import { tryPushAvatarToPlex } from "@/lib/plex/avatarSync";

export const dynamic = "force-dynamic";

/** Upload de la photo de profil (soi-même uniquement) — multipart `file`.
 *  JPEG/PNG/WebP/GIF ≤ 2 Mo (magic bytes vérifiés, pas l'extension).
 *  Répond `{ avatar: "/api/avatars/{id}?v=…" }` à répercuter côté client. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (file.size > AVATAR_MAX_BYTES) return NextResponse.json({ error: "too_big" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const saved = saveAvatar(user.id, bytes);
  if ("error" in saved) {
    const status = saved.error === "bad_type" ? 415 : 400;
    return NextResponse.json({ error: saved.error }, { status });
  }
  const now = Date.now();
  updateUser(user.id, {
    customAvatar: saved.url,
    avatarUpdatedAt: now,
    avatarSource: "movviz",
  });
  // Local success never waits for, or depends on, Plex.
  tryPushAvatarToPlex(user.id).catch(() => {});
  return NextResponse.json({ avatar: saved.url });
}

/** Retour à la photo Plex (ou initiales) : supprime le fichier perso. */
export async function DELETE(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  deleteAvatar(user.id);
  updateUser(user.id, {
    customAvatar: null,
    avatarUpdatedAt: Date.now(),
    avatarSource: "plex",
  });
  return NextResponse.json({ ok: true });
}

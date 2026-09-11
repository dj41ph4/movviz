import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { avatarFileFor, isSafeUserId } from "@/lib/avatars";

export const dynamic = "force-dynamic";

/** Photo de profil publique (comme les thumbs Plex) — pas d'auth requise,
 *  cache long côté client (l'URL est versionnée à chaque upload). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isSafeUserId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const found = avatarFileFor(id);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const bytes = fs.readFileSync(found.file);
  // bytes.buffer peut déborder du fichier (pool Node) — on recadre.
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new NextResponse(body, {
    headers: {
      "content-type": found.mime,
      "cache-control": "public, max-age=86400",
    },
  });
}

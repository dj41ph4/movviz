import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolvePlexPartUrl } from "@/lib/playback/plexSource";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ratingKey: string }> };

/**
 * Vignette de scrub (aperçu au survol de la barre de progression) — proxy
 * l'index BIF que Plex génère déjà pour son propre lecteur web
 * (`/library/parts/{id}/indexes/sd/{ms}`, confirmé en direct : 200,
 * image/jpeg) quand la bibliothèque a "Générer les miniatures d'aperçu
 * vidéo" activé. Jamais exposé au client tel quel — mêmes raisons que le
 * reste du pipeline stream : le host/port/token Plex ne doivent jamais
 * fuiter côté navigateur.
 */
export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;

  const tParam = req.nextUrl.searchParams.get("t");
  const tMs = Math.max(0, Math.floor(Number(tParam)));
  if (!tParam || !Number.isFinite(tMs)) {
    return NextResponse.json({ error: "invalid_t" }, { status: 400 });
  }

  const ref = await resolvePlexPartUrl(ratingKey, user.id);
  if (!ref || !ref.partId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const bifRes = await fetch(`${ref.base}/library/parts/${ref.partId}/indexes/sd/${tMs}`, {
      headers: ref.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!bifRes.ok || !bifRes.body) {
      // Absent le plus souvent parce que "Générer les miniatures d'aperçu
      // vidéo" n'est pas activé pour cette bibliothèque côté Plex — pas une
      // erreur applicative, le client masque simplement l'aperçu.
      return NextResponse.json({ error: "thumb_unavailable" }, { status: 404 });
    }
    return new NextResponse(bifRes.body, {
      headers: {
        "content-type": bifRes.headers.get("content-type") || "image/jpeg",
        // Une vignette pour un (ratingKey, t) donné ne change jamais.
        "cache-control": "private, max-age=86400, immutable",
      },
    });
  } catch (e) {
    console.error("[scrub-thumb] fetch failed", ratingKey, tMs, e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}

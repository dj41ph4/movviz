import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { isScrubSpritesEnabled } from "@/lib/settings/scrubSprites";
import { ensureSprites, failureReason, hasRecentlyFailed, isGenerating, readManifest, resolveLocalSource, setSpriteHint, sheetPath, shouldYieldToPlayback } from "@/lib/playback/scrubSprites";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ratingKey: string }> };

/**
 * Aperçus de la barre de progression générés par Movviz (ffmpeg), pour les
 * fichiers que Plex n'a pas préparés — voir lib/playback/scrubSprites.ts.
 *
 *   GET ?m=1&at=S     → manifeste JSON (200), ou 202 « en préparation ». Le manifeste liste les
 *                       planches déjà prêtes (`ready`) : elles servent sans attendre la fin
 *                       (`complete`). `at` = seconde regardée, préparée en premier.
 *   GET ?m=1&probe=1  → manifeste (200) ou 204 : ne lance jamais de génération
 *   GET ?sheet=N&v=…  → planche JPEG de 10×10 vignettes
 *
 * Premier survol d'un fichier sans planches : la génération démarre en
 * arrière-plan (priorité basse) et le lecteur redemande plus tard.
 */
export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isScrubSpritesEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });

  const { ratingKey } = await context.params;
  const source = resolveLocalSource(ratingKey);
  if (!source) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const sheetParam = req.nextUrl.searchParams.get("sheet");
  if (sheetParam != null) {
    const file = sheetPath(source.cacheId, Number(sheetParam));
    if (!file || !fs.existsSync(file)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
      headers: {
        "content-type": "image/jpeg",
        // L'URL porte la version du fichier source (`v`) : une planche donnée ne change jamais.
        "cache-control": "private, max-age=86400, immutable",
      },
    });
  }

  const probe = req.nextUrl.searchParams.get("probe") === "1";
  // Zone regardée : la préparation commence par là (puis le reste du film).
  const atParam = req.nextUrl.searchParams.get("at");
  const at = atParam != null && atParam !== "" ? Number(atParam) : null;
  const startAtSec = at != null && Number.isFinite(at) && at >= 0 ? at : undefined;
  // La lecture passe avant tout : pendant un transcodage vidéo (le plus lourd), rien n'est lancé.
  // Une lecture en copie de la vidéo ne bloque pas la préparation (priorité minimale, longues pauses).
  const yielding = shouldYieldToPlayback();
  const failedRecently = hasRecentlyFailed(source.cacheId);
  const start = () => {
    // Génération en arrière-plan : échec ou succès sont consignés, jamais remontés au lecteur.
    if (!probe && !yielding && !failedRecently && !isGenerating(source.cacheId)) void ensureSprites(source, { startAtSec }).catch(() => {});
  };

  const manifest = await readManifest(source);
  if (manifest) {
    // Planches déjà publiées utilisables tout de suite, même si la préparation n'est pas terminée :
    // on poursuit (ou on reprend) la génération, en commençant par la zone regardée.
    if (!manifest.complete) {
      if (startAtSec != null) setSpriteHint(source.cacheId, startAtSec);
      start();
    }
    return NextResponse.json(manifest, { headers: { "cache-control": "private, no-store" } });
  }

  // Sonde : « existe-t-il déjà des planches ? » sans jamais en déclencher la génération
  // (fichier lié à Plex dont Plex fournit encore les aperçus).
  if (probe) return new NextResponse(null, { status: 204 });

  // Génération déjà tentée sans succès : le lecteur cesse de demander (404) au lieu de relancer à chaque survol.
  if (failedRecently) return NextResponse.json({ error: "unavailable", reason: failureReason(source.cacheId) }, { status: 404 });

  if (yielding) return NextResponse.json({ state: "waiting" }, { status: 202, headers: { "cache-control": "private, no-store" } });

  start();
  return NextResponse.json({ state: "pending" }, { status: 202, headers: { "cache-control": "private, no-store" } });
}

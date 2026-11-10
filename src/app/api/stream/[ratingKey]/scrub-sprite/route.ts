import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { isScrubSpritesEnabled } from "@/lib/settings/scrubSprites";
import { ensureSprites, isGenerating, readManifest, resolveLocalSource, sheetPath } from "@/lib/playback/scrubSprites";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ratingKey: string }> };

/**
 * Aperçus de la barre de progression générés par Movviz (ffmpeg), pour les
 * fichiers que Plex n'a pas préparés — voir lib/playback/scrubSprites.ts.
 *
 *   GET ?m=1          → manifeste JSON (200), ou 202 « en préparation »
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

  const manifest = await readManifest(source);
  if (manifest) return NextResponse.json(manifest, { headers: { "cache-control": "private, no-store" } });

  if (!isGenerating(source.cacheId)) {
    // Génération en arrière-plan : échec ou succès sont consignés, jamais remontés au lecteur.
    void ensureSprites(source).catch(() => {});
  }
  return NextResponse.json({ state: "pending" }, { status: 202, headers: { "cache-control": "private, no-store" } });
}

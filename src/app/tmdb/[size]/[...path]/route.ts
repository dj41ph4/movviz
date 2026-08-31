import { NextRequest, NextResponse } from "next/server";
import { readTmdbImage } from "@/lib/metadata/tmdbImageCache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ size: string; path: string[] }> };

/**
 * Same-origin TMDb image endpoint backed by Movviz's immutable on-disk cache.
 * A card can therefore be instant both from the browser cache and, after a
 * browser/device restart, from the server cache without another CDN request.
 */
export async function GET(_req: NextRequest, { params }: Context) {
  const { size, path } = await params;
  if (path.length !== 1) return new NextResponse(null, { status: 404 });
  const image = await readTmdbImage(size, path[0]);
  if (!image) return new NextResponse(null, { status: 404 });
  // Node's Buffer is a Uint8Array view with an offset; copy exactly the image
  // bytes into an ArrayBuffer, which is the portable Next/Fetch response body.
  const body = new Uint8Array(image.body.byteLength);
  body.set(image.body);
  return new NextResponse(body.buffer, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getC411Rows } from "@/lib/c411/catalog";

export const dynamic = "force-dynamic";

/**
 * C411 front-page lists (populaire / uploads récents / sorties du jour) for
 * the Discover tab. Only exists when the C411 indexer has lists enabled with
 * site credentials — otherwise `configured` is false and the client shows
 * nothing.
 */
export async function GET(_req: NextRequest) {
  requireUser(_req);
  const { configured, rows } = await getC411Rows();
  return NextResponse.json({ configured, rows });
}

import { NextRequest, NextResponse } from "next/server";
import { getEngineToken } from "@/lib/engine/token";
import { logActivityV2 } from "@/lib/activity/v2/store";
import { recordFailedRelease } from "@/lib/library/failedReleases";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-movviz-token") !== getEngineToken()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();

    if (body.kind === "failed" && body.failure?.code === "no_peers_for_piece" && body.infoHash) {
      recordFailedRelease(body.infoHash);
    }

    const entry = logActivityV2({
      kind: body.kind,
      media: body.media,
      actor: body.actor ?? "system",
      release: body.release,
      download: body.download,
      import: body.import,
      failure: body.failure,
      metadata: body.metadata,
    });

    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    console.error("[activity/log] error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
import { NextResponse } from "next/server";
import { loadTmdbKey } from "@/lib/metadata/store";

export const dynamic = "force-dynamic";

const BASE = "https://api.themoviedb.org/3";

export async function GET() {
  const key = process.env.MOVVIZ_TMDB_API_KEY ?? loadTmdbKey();
  if (!key) {
    return NextResponse.json({ ok: false, error: "no_key" });
  }
  try {
    const url = `${BASE}/configuration?api_key=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      console.log("[api/metadata/key/test] OK — key is valid");
      return NextResponse.json({ ok: true });
    }
    const body = await res.json().catch(() => ({}));
    console.log("[api/metadata/key/test] FAIL — status=" + res.status + " body=" + JSON.stringify(body));
    return NextResponse.json({
      ok: false,
      error: res.status === 401 ? "invalid_key" : "http_" + res.status,
    });
  } catch (e) {
    console.log("[api/metadata/key/test] ERROR — " + e);
    return NextResponse.json({ ok: false, error: "network" });
  }
}

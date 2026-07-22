import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadWebhook } from "@/lib/webhooks/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const webhook = loadWebhook();
  if (!webhook.url) return NextResponse.json({ ok: false, error: "no_url" }, { status: 400 });
  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "**Movviz** — test notification" }),
    });
    return NextResponse.json({ ok: res.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}

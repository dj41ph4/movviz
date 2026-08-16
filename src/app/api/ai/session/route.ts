import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadAiSession, clearAiSession } from "@/lib/ai/store";
import { loadAiConfig } from "@/lib/ai/store";

export const dynamic = "force-dynamic";

/** Returns the user's in-memory chat session so the widget can restore its
 *  history after a navigation/remount, plus whether the AI feature is
 *  enabled at all (the widget hides itself when it isn't). */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ messages: loadAiSession(user.id).messages, enabled: loadAiConfig().enabled });
}

/** POST { clear: true } wipes the user's chat session (memory of past
 *  interactions stays intact — only the conversation is reset). */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.clear === true) {
    clearAiSession(user.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "invalid body" }, { status: 400 });
}
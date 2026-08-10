import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadUserPrefs, saveUserPrefs } from "@/lib/userPrefs/store";

export const dynamic = "force-dynamic";

/**
 * Per-user personalization (GPU tier/animations, theme, interface language,
 * library view mode) — previously localStorage-only, so it reset on every
 * new browser/device. Each field is saved independently by whichever
 * provider owns it (GpuProvider, useTheme, I18nProvider, library page) via a
 * PATCH that only ever touches its own field.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ prefs: loadUserPrefs(user.id) });
}

export async function PATCH(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  return NextResponse.json({ prefs: saveUserPrefs(user.id, body) });
}

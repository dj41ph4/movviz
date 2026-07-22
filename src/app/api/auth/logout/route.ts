import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/store";
import { SESSION_COOKIE, clearSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}

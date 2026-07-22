import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyUser } from "@/lib/auth/store";
import { toPublicUser } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = getCurrentUser(req);
  return NextResponse.json({
    user: user ? toPublicUser(user) : null,
    setupRequired: !hasAnyUser(),
  });
}

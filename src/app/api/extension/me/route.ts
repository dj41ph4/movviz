import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireExtensionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    username: user.username,
    isAdmin: user.role === "admin",
    autoApprove: user.role === "admin" || !!user.autoApproveRequests,
  });
}

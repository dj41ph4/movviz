import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasAnyUser } from "@/lib/auth/store";
import { plexConfigured } from "@/lib/plex/store";
import { toPublicUser } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = getCurrentUser(req);
  return NextResponse.json({
    user: user ? toPublicUser(user) : null,
    setupRequired: !hasAnyUser(),
    setupPending: !!user && user.role === "admin" && fs.existsSync(path.join(process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data"), "setup-pending")),
    plexLoginAvailable: hasAnyUser() && plexConfigured(),
  });
}

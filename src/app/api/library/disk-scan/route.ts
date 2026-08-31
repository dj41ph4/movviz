import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { fullDiskScan, incrementalDiskScan, getScanState } from "@/lib/library/diskScan";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(getScanState());
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const incremental = req.nextUrl.searchParams.get("incremental") === "1";
  const result = incremental ? await incrementalDiskScan() : await fullDiskScan();
  return NextResponse.json(result);
}

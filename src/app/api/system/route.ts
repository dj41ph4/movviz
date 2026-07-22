import { NextResponse } from "next/server";
import { systemInfo } from "@/lib/system";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(systemInfo());
}

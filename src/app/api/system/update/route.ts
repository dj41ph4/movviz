import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/guard";

const REPO_OWNER = "dj41ph4";
const REPO_NAME = "movviz";
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

function getCurrentVersion(): string {
  const pkgPath = path.join(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return pkg.version;
}

async function getLatestRelease(): Promise<{
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  assets: { name: string; browser_download_url: string; size: number }[];
} | null> {
  try {
    const res = await fetch(GITHUB_API, {
      headers: { accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const currentVersion = getCurrentVersion();
  const latest = await getLatestRelease();

  if (!latest) {
    return NextResponse.json({
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      platform: process.platform,
      releaseNotes: null,
      downloadUrl: null,
    });
  }

  const latestVersion = latest.tag_name.replace(/^v/, "");
  const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

  const installerAsset = latest.assets.find((a) =>
    a.name.startsWith("Movviz-Setup-") && a.name.endsWith(".exe")
  );

  return NextResponse.json({
    currentVersion,
    latestVersion: updateAvailable ? latestVersion : null,
    updateAvailable,
    platform: process.platform,
    releaseNotes: latest.body,
    downloadUrl: installerAsset?.browser_download_url ?? null,
    releaseUrl: latest.html_url,
  });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (process.platform !== "win32") {
    return NextResponse.json({ error: "not_windows" }, { status: 400 });
  }
  const currentVersion = getCurrentVersion();
  const latest = await getLatestRelease();

  if (!latest) {
    return NextResponse.json({ error: "no_release" }, { status: 404 });
  }

  const latestVersion = latest.tag_name.replace(/^v/, "");
  if (compareVersions(latestVersion, currentVersion) <= 0) {
    return NextResponse.json({ error: "already_latest" }, { status: 400 });
  }

  const installerAsset = latest.assets.find((a) =>
    a.name.startsWith("Movviz-Setup-") && a.name.endsWith(".exe")
  );
  if (!installerAsset) {
    return NextResponse.json({ error: "no_installer" }, { status: 404 });
  }

  const SAFE_NAME_RE = /^Movviz-Setup-\d+\.\d+\.\d+\.exe$/;
  if (!SAFE_NAME_RE.test(installerAsset.name)) {
    return NextResponse.json({ error: "invalid_installer_name" }, { status: 400 });
  }

  const downloadUrl = installerAsset.browser_download_url;
  const tempDir = path.join(process.env.TEMP ?? process.cwd(), "movviz-update");
  const installerPath = path.join(tempDir, installerAsset.name);

  try {
    fs.mkdirSync(tempDir, { recursive: true });

    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error("download failed");
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(installerPath, Buffer.from(buffer));

    if (process.platform === "win32") {
      const { spawn } = await import("node:child_process");
      spawn(installerPath, ["/SILENT", "/SUPPRESSMSGBOXES", "/NORESTART"], {
        detached: true,
        stdio: "ignore",
      }).unref();
    }

    return NextResponse.json({ success: true, path: installerPath });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
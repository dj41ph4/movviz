import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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

// A Docker container is also `process.platform === "linux"`, but has no
// systemd to restart it and its filesystem is typically ephemeral/managed
// by the image, not this native-install layout — self-updating in place
// there would be actively wrong (nothing durable, nothing to restart it).
// /.dockerenv is Docker's own long-standing container marker file, created
// unconditionally by the container runtime, not something this app sets.
function isNativeLinuxInstall(): boolean {
  return process.platform === "linux" && !fs.existsSync("/.dockerenv");
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const currentVersion = getCurrentVersion();
  const latest = await getLatestRelease();

  const oneClickSupported = process.platform === "win32" || isNativeLinuxInstall();

  if (!latest) {
    return NextResponse.json({
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      platform: process.platform,
      oneClickSupported,
      releaseNotes: null,
      downloadUrl: null,
    });
  }

  const latestVersion = latest.tag_name.replace(/^v/, "");
  const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

  const installerAsset = process.platform === "win32"
    ? latest.assets.find((a) => a.name.startsWith("Movviz-Setup-") && a.name.endsWith(".exe"))
    : latest.assets.find((a) => a.name === "movviz-linux-x64.tar.gz");

  return NextResponse.json({
    currentVersion,
    latestVersion: updateAvailable ? latestVersion : null,
    updateAvailable,
    platform: process.platform,
    oneClickSupported,
    releaseNotes: latest.body,
    downloadUrl: installerAsset?.browser_download_url ?? null,
    releaseUrl: latest.html_url,
  });
}

async function updateWindows(latestVersion: string, latest: NonNullable<Awaited<ReturnType<typeof getLatestRelease>>>) {
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

  const tempDir = path.join(process.env.TEMP ?? process.cwd(), "movviz-update");
  const installerPath = path.join(tempDir, installerAsset.name);

  fs.mkdirSync(tempDir, { recursive: true });
  const res = await fetch(installerAsset.browser_download_url);
  if (!res.ok) throw new Error("download failed");
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(installerPath, Buffer.from(buffer));

  const { spawn } = await import("node:child_process");
  spawn(installerPath, ["/SILENT", "/SUPPRESSMSGBOXES", "/NORESTART"], {
    detached: true,
    stdio: "ignore",
  }).unref();

  return NextResponse.json({ success: true, path: installerPath });
}

// Downloads the pre-built tarball (linux-release-build.yml) and extracts it
// OVER the currently-running .next/standalone directory — safe on Linux
// (unlike Windows, an open/mapped file's inode stays valid after being
// replaced; the running process keeps working off the old inode until it
// exits). Deliberately does NOT restart the service itself: this process IS
// the service, and movviz.service's `Restart=always` (packaging/linux/
// movviz.service) respawns it automatically on a clean exit, picking up the
// freshly-extracted code — no root/systemctl access needed at update time,
// only at initial install (see install.sh).
async function updateLinux(latestVersion: string, latest: NonNullable<Awaited<ReturnType<typeof getLatestRelease>>>) {
  const asset = latest.assets.find((a) => a.name === "movviz-linux-x64.tar.gz");
  if (!asset) {
    return NextResponse.json({ error: "no_installer" }, { status: 404 });
  }

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-update-"));
  const tarballPath = path.join(tempDir, "movviz-linux-x64.tar.gz");

  const res = await fetch(asset.browser_download_url);
  if (!res.ok) throw new Error("download failed");
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(tarballPath, Buffer.from(buffer));

  await execFileAsync("tar", ["-xzf", tarballPath, "-C", tempDir]);
  const extractedDir = path.join(tempDir, "movviz");
  if (!fs.existsSync(extractedDir)) throw new Error("unexpected archive layout");

  // cwd is already .next/standalone (server.js's own working directory) —
  // swap its contents in place rather than the parent .next dir, so a
  // process still holding the old server.js open never sees a moved-away
  // parent directory mid-request.
  const standaloneDir = process.cwd();
  fs.rmSync(standaloneDir, { recursive: true, force: true, maxRetries: 3 });
  fs.renameSync(extractedDir, standaloneDir);
  // standaloneDir = /opt/movviz/.next/standalone → version file lives at
  // /opt/movviz/.movviz-version, two levels up (see install.sh's VERSION_FILE).
  const versionFilePath = path.join(standaloneDir, "..", "..", ".movviz-version");
  fs.writeFileSync(versionFilePath, latestVersion);
  fs.rmSync(tempDir, { recursive: true, force: true });

  // Respond BEFORE exiting — the client's fetch must resolve, and the
  // banner's own polling loop already expects the connection to drop
  // shortly after (see UpdateAvailableBanner.tsx, same contract as Windows).
  setTimeout(() => process.exit(0), 500);
  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const isWindows = process.platform === "win32";
  if (!isWindows && !isNativeLinuxInstall()) {
    return NextResponse.json({ error: "unsupported_platform" }, { status: 400 });
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

  try {
    return isWindows ? await updateWindows(latestVersion, latest) : await updateLinux(latestVersion, latest);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
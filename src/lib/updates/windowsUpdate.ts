import { getAppVersion } from "./version";

const REPO = "dj41ph4/movviz";

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  downloadUrl: string | null;
}

function isNewer(latest: string, current: string): boolean {
  const a = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** Checks the public GitHub Releases API for a newer tagged installer — no auth needed, the repo is public. */
export async function checkForWindowsUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = getAppVersion();
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { accept: "application/vnd.github+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { currentVersion, latestVersion: null, updateAvailable: false, downloadUrl: null };

    const data = await res.json();
    const latestVersion = String(data.tag_name ?? "").replace(/^v/, "");
    const asset = ((data.assets ?? []) as { name: string; browser_download_url: string }[]).find((a) =>
      /\.exe$/i.test(a.name)
    );
    const updateAvailable = !!latestVersion && !!asset && isNewer(latestVersion, currentVersion);
    return { currentVersion, latestVersion: latestVersion || null, updateAvailable, downloadUrl: asset?.browser_download_url ?? null };
  } catch {
    return { currentVersion, latestVersion: null, updateAvailable: false, downloadUrl: null };
  }
}

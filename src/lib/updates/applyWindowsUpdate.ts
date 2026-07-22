import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface ApplyState {
  status: "idle" | "downloading" | "launching" | "error";
  error: string | null;
  startedAt: number | null;
}

// Anchored on globalThis — the POST that kicks this off and the GET the UI
// polls for progress can land in different route bundles.
const g = globalThis as typeof globalThis & { __movvizUpdateApplyState?: ApplyState };
const state: ApplyState = (g.__movvizUpdateApplyState ??= { status: "idle", error: null, startedAt: null });

export function getUpdateApplyState(): ApplyState {
  return state;
}

/**
 * Downloads the installer asset and launches it silently. The installer
 * itself (packaging/windows/installer/movviz.iss) already knows how to
 * update over an existing install: it stops and force-kills the current
 * service/engine process, replaces the app files (user data lives in
 * %ProgramData%\Movviz, untouched), then reinstalls and restarts the
 * service — so once the child process is launched, THIS process is going
 * to be killed a few seconds later. Nothing after the spawn can rely on
 * still running.
 */
export async function applyWindowsUpdate(downloadUrl: string): Promise<void> {
  if (process.platform !== "win32") throw new Error("windows_only");
  if (state.status !== "idle") throw new Error("already_running");

  state.status = "downloading";
  state.error = null;
  state.startedAt = Date.now();
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = path.join(os.tmpdir(), "MovvizUpdate.exe");
    fs.writeFileSync(dest, buf);

    state.status = "launching";
    const child = spawn(dest, ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch (err) {
    state.status = "error";
    state.error = err instanceof Error ? err.message : "unknown error";
    throw err;
  }
}

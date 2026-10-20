import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface WindowsUpdateProgress {
  status: "idle" | "queued" | "downloading" | "installing" | "verifying" | "complete" | "error";
  version?: string;
  error?: string;
  updatedAt?: string;
}

export function updateServiceDirectory(): string {
  // Separate from Movviz's users-modify data directory: only SYSTEM/admins
  // may enqueue privileged installations. Created by the Windows installer.
  return path.join(process.env.ProgramData ?? "C:\\ProgramData", "MovvizUpdater");
}

export function readWindowsUpdateProgress(directory = updateServiceDirectory()): WindowsUpdateProgress {
  try {
    return JSON.parse(fs.readFileSync(path.join(directory, "status.json"), "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return { status: "idle" };
  }
}

export function queueWindowsUpdate(version: string, directory = updateServiceDirectory()): void {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("invalid_version");
  if (fs.existsSync(path.join(directory, "active.json"))) throw new Error("update_already_running");
  try {
    if (Date.now() - fs.statSync(path.join(directory, "heartbeat")).mtimeMs > 30_000) throw new Error("stale");
  } catch {
    throw new Error("update_service_unavailable");
  }
  const slot = path.join(directory, "pending");
  try { fs.mkdirSync(slot); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("update_already_running");
    throw error;
  }
  const temporary = path.join(slot, `${randomUUID()}.tmp`);
  let queued = false;
  try {
    fs.writeFileSync(temporary, JSON.stringify({ version }), { flag: "wx" });
    // Publish the complete request atomically, without replacing an existing
    // request. No executable path, URL, or shell command crosses this boundary.
    fs.linkSync(temporary, path.join(directory, "request.json"));
    queued = true;
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    if (!queued) fs.rmdirSync(slot);
  }
}

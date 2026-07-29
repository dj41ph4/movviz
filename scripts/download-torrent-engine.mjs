#!/usr/bin/env node
/**
 * Auto-download the native torrent engine binary for the current platform,
 * extracted into engine/aria2/ so it can be bundled by the Windows installer.
 *
 * Runs as a standalone script (not a postinstall hook).
 * Skips if the binary already exists.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import http from "node:http";
import https from "node:https";

const ARIA2_VERSION = "1.37.0";
const ROOT = path.resolve(import.meta.dirname, "..");

function platformTag() {
  if (process.platform === "win32") return "win-64bit";
  if (process.platform === "darwin") return "macos-64bit";
  return "linux-64bit";
}

function binaryName() {
  return process.platform === "win32" ? "aria2c.exe" : "aria2c";
}

function outDir() {
  return path.join(ROOT, "engine", "aria2");
}

function outPath() {
  return path.join(outDir(), binaryName());
}

function downloadUrl() {
  const tag = platformTag();
  const ext = process.platform === "win32" ? "zip" : "tar.gz";
  return `https://github.com/aria2/aria2/releases/download/release-${ARIA2_VERSION}/aria2-${ARIA2_VERSION}-${tag}-build1.${ext}`;
}

async function download(url, dest) {
  const proto = url.startsWith("https") ? https : http;
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  return new Promise((resolve, reject) => {
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const file = createWriteStream(dest);
      pipeline(res, file).then(resolve).catch(reject);
    }).on("error", reject);
  });
}

async function extractZip(zipPath, targetDir) {
  // Use a simple approach: spawn tar if available (Windows 10+ has it),
  // otherwise use a minimal unzip.
  try {
    await fsp.mkdir(targetDir, { recursive: true });
    await new Promise((resolve, reject) => {
      const child = spawn("tar", ["-xf", zipPath, "-C", targetDir], { stdio: "ignore" });
      child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`tar exit code ${code}`)));
      child.on("error", reject);
    });
  } catch {
    // Fallback: use PowerShell's Expand-Archive on Windows.
    if (process.platform === "win32") {
      await new Promise((resolve, reject) => {
        const ps = spawn("powershell", [
          "-NoProfile", "-Command",
          `Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force`,
        ], { stdio: "ignore" });
        ps.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Expand-Archive exit code ${code}`)));
        ps.on("error", reject);
      });
    } else {
      throw new Error("No unzip tool available");
    }
  }
}

async function extractTarGz(tarPath, targetDir) {
  await fsp.mkdir(targetDir, { recursive: true });
  try {
    await new Promise((resolve, reject) => {
      const child = spawn("tar", ["-xzf", tarPath, "-C", targetDir], { stdio: "ignore" });
      child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`tar exit code ${code}`)));
      child.on("error", reject);
    });
  } catch (e) {
    throw new Error(`Cannot extract ${tarPath}: ${e.message}. Install tar.`);
  }
}

async function findAria2cInDir(dir) {
  const bin = binaryName();
  try {
    const entries = await fsp.readdir(dir, { recursive: true });
    for (const entry of entries) {
      if (entry.endsWith(bin)) return path.join(dir, entry);
    }
  } catch {}
  // Check common subdirectories
  for (const sub of await fsp.readdir(dir).catch(() => [])) {
    const subPath = path.join(dir, sub, bin);
    if (fs.existsSync(subPath)) return subPath;
    const subSub = path.join(dir, sub, "bin", bin);
    if (fs.existsSync(subSub)) return subSub;
  }
  return null;
}

async function main() {
  const dest = outPath();
  if (fs.existsSync(dest)) {
    console.log(`[torrent-engine] already present at ${dest}`);
    return;
  }

  const url = downloadUrl();
  const tmpDir = path.join(ROOT, "node_modules", ".aria2-tmp");
  const archive = path.join(tmpDir, `aria2.${process.platform === "win32" ? "zip" : "tar.gz"}`);

  console.log(`[torrent-engine] downloading ${url}...`);
  await fsp.mkdir(tmpDir, { recursive: true });
  await download(url, archive);

  console.log(`[torrent-engine] extracting...`);
  if (process.platform === "win32") {
    await extractZip(archive, tmpDir);
  } else {
    await extractTarGz(archive, tmpDir);
  }

  // Find the binary after extraction
  const extracted = await findAria2cInDir(tmpDir);
  if (!extracted) {
    // Try to guess the path
    const guess = path.join(tmpDir, `aria2-${ARIA2_VERSION}`, binaryName());
    if (fs.existsSync(guess)) {
      await fsp.mkdir(outDir(), { recursive: true });
      await fsp.copyFile(guess, dest);
      await fsp.chmod(dest, 0o755);
    } else {
      throw new Error(`aria2c binary not found after extraction in ${tmpDir}`);
    }
  } else {
    await fsp.mkdir(outDir(), { recursive: true });
    await fsp.copyFile(extracted, dest);
    await fsp.chmod(dest, 0o755);
  }

  // Cleanup
  await fsp.rm(tmpDir, { recursive: true, force: true });

  console.log(`[torrent-engine] installed at ${dest}`);
}

main().catch((e) => {
  console.error(`[torrent-engine] download failed: ${e.message}`);
  console.error(`[torrent-engine] the native engine will not be available. Install manually or use WebTorrent.`);
  process.exit(0); // Non-fatal — user can still use WebTorrent
});

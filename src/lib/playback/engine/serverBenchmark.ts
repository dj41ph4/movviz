/**
 * Explicit user request (2026-08-24, mid-investigation of the DS923+'s real
 * software-transcode ceiling): a way to actually SEE this server's real
 * transcode speed instead of discovering it live mid-playback. Runs a real,
 * short ffmpeg encode for each of the profiles decidePlayback.ts actually
 * produces (see decidePlayback.ts's own SOFTWARE_TRANSCODE_MAX_WIDTH /
 * SOFTWARE_TONEMAP_MAX_WIDTH / SOFTWARE_TONEMAP_PRESET investigation,
 * 2026-08-24) and measures the real realtime factor (seconds of video
 * encoded per second of wall time) — the same metric this session used
 * live, by hand, to find and size every fix in that investigation.
 *
 * Manual trigger (Réglages → Performance), auto-run right after an update
 * (instrumentation.ts, comparing the persisted result's own appVersion
 * against package.json's current one — works identically whether the
 * update came from the Windows one-click installer or a Docker/NAS image
 * re-pull, since both end in a fresh process boot either way), and a
 * monthly scheduled task (scheduler/tasks.ts) all call
 * `runServerBenchmark()` — same function, three triggers, one persisted
 * result (readServerBenchmark()).
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { resolveFfmpegBinary } from "./mediaRuntime";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { detectServerCapabilities } from "./serverCapabilities.detect";

function currentAppVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    return (JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string }).version ?? "unknown";
  } catch {
    return "unknown";
  }
}

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "server-benchmark.json");

export interface BenchmarkProfileResult {
  id: string;
  label: string;
  encoderImpl: string;
  isHardware: boolean;
  /** Seconds of output video produced per second of real (wall-clock) time.
   *  1.0 = exactly real-time. Below 1.0 means this profile will fall behind
   *  live playback and buffer/stall — the exact symptom this session spent
   *  hours chasing live before this number existed to just look up. */
  realtimeFactor: number | null;
  /** Set when the encode itself failed (bad flags, missing encoder, timeout)
   *  — realtimeFactor is null in that case, not a misleadingly-precise 0. */
  error: string | null;
}

export interface ServerBenchmarkResult {
  ranAt: number;
  durationMs: number;
  /** The app version that produced this result — compared against the
   *  CURRENT version at boot to decide whether an update just installed and
   *  a fresh benchmark is due (see shouldAutoRunBenchmark() below). */
  appVersion: string;
  hardwareAcceleration: {
    nvenc: boolean;
    qsv: boolean;
    vaapi: boolean;
    amf: boolean;
    videotoolbox: boolean;
  };
  profiles: BenchmarkProfileResult[];
}


// 3s is enough to get a stable realtime-factor reading (GOP boundaries etc.
// average out) without making a manual/monthly benchmark itself slow — even
// at a hypothetically bad 0.1x factor this is a 30s wait, not minutes.
const TEST_DURATION_SEC = 3;

function runFfmpeg(args: string[], timeoutMs: number): Promise<{ ok: boolean; wallMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let p: ChildProcess;
    try {
      p = spawn(resolveFfmpegBinary(), args, { stdio: ["ignore", "ignore", "ignore"] });
    } catch {
      resolve({ ok: false, wallMs: 0 });
      return;
    }
    const t = setTimeout(() => {
      try { p.kill("SIGKILL"); } catch { /* already dead */ }
      resolve({ ok: false, wallMs: Date.now() - start });
    }, timeoutMs);
    p.on("error", () => { clearTimeout(t); resolve({ ok: false, wallMs: Date.now() - start }); });
    p.on("exit", (code) => { clearTimeout(t); resolve({ ok: code === 0, wallMs: Date.now() - start }); });
  });
}

async function runProfile(id: string, label: string, encoderImpl: string, isHardware: boolean, args: string[]): Promise<BenchmarkProfileResult> {
  const { ok, wallMs } = await runFfmpeg(args, 30_000);
  if (!ok) {
    return { id, label, encoderImpl, isHardware, realtimeFactor: null, error: "encode_failed" };
  }
  return { id, label, encoderImpl, isHardware, realtimeFactor: TEST_DURATION_SEC / (wallMs / 1000), error: null };
}

// Same GOP as localExecutor.ts's real GOP_ARGS (2s at ~24fps) — a
// representative test needs the same keyframe cost the real pipeline pays.
const GOP_ARGS = ["-g", "48", "-keyint_min", "48", "-sc_threshold", "0"];

/**
 * Same zscale/tonemap HDR→SDR chain as localExecutor.ts's real one, MORE
 * explicit than that one has to be — localExecutor.ts's chain lets zscale
 * read primaries/transfer/matrix straight from the real file's own frame
 * metadata (every real HDR10 file has it), but this benchmark's synthetic
 * `color=` source carries none at all. Confirmed live (2026-08-24): zscale
 * fails outright ("no path between colorspaces") the moment ANY of
 * primaries/transfer/matrix is left on both sides as "input" (-1) when the
 * source has no real tag to inherit — even a plain bt709→bt709 no-op
 * conversion failed under that condition, and specifically the `t=linear`
 * step needed `p=`/`m=` stated explicitly too, not just the transfer. Every
 * stage below is now fully explicit on both `*in=` (declaring the
 * untagged synthetic source AS bt2020/smpte2084/bt2020nc, i.e. real HDR10)
 * and the output side, and produces a real encoded frame end-to-end. A
 * benchmark that silently skipped this (encode_failed) would have
 * understated the true HDR case entirely, not just its cost.
 */
const TONEMAP_FILTER = "zscale=primariesin=bt2020:transferin=smpte2084:matrixin=bt2020nc:rangein=limited:p=bt2020:t=linear:m=bt2020nc:npl=100,format=gbrpf32le,zscale=p=bt709:t=linear:m=bt709,tonemap=tonemap=hable:desat=0,zscale=p=bt709:t=bt709:m=bt709:r=tv,format=yuv420p";

export async function runServerBenchmark(): Promise<ServerBenchmarkResult> {
  const start = Date.now();
  const server = await detectServerCapabilities();
  const profiles: BenchmarkProfileResult[] = [];

  // Profile 1 — plain software transcode, no tonemap (matches the
  // SOFTWARE_TRANSCODE_MAX_WIDTH=1920/veryfast case: a typical SDR source
  // with no working hardware encoder).
  profiles.push(await runProfile(
    "software_1080p",
    "Logiciel 1080p (sans HDR)",
    "libx264",
    false,
    [
      "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", `color=c=gray:s=1920x1080:r=24:d=${TEST_DURATION_SEC}`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", ...GOP_ARGS,
      "-pix_fmt", "yuv420p", "-f", "null", "-",
    ]
  ));

  // Profile 2 — the hardest real case found this session: software
  // transcode + HDR→SDR tonemap (matches SOFTWARE_TONEMAP_MAX_WIDTH=720/
  // ultrafast). Source declared as real HDR10 (bt2020/smpte2084) so the
  // tonemap filter chain does genuine work, not a no-op on SDR-tagged input.
  profiles.push(await runProfile(
    "software_720p_tonemap",
    "Logiciel 720p (conversion HDR→SDR)",
    "libx264",
    false,
    [
      "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", `color=c=gray:s=3840x2160:r=24:d=${TEST_DURATION_SEC},format=yuv420p10le`,
      // TONEMAP_FILTER's own `*in=` params declare this untagged synthetic
      // source as real HDR10 — no separate -color_primaries/-color_trc
      // output flags needed (those tag the ENCODED stream, they're not read
      // by zscale as an input hint at all — confirmed live this was a dead
      // end before finding the real fix, see TONEMAP_FILTER's comment).
      "-vf", `scale=720:-2,${TONEMAP_FILTER}`,
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", ...GOP_ARGS,
      "-pix_fmt", "yuv420p", "-f", "null", "-",
    ]
  ));

  // Profile 3 — only if a hardware encoder was actually VERIFIED (Phase 6
  // fix, 2026-08-24: never trust the compiled-encoder list alone) — confirms
  // the real, working hardware path stays comfortably ahead of real time
  // too, not just that it exists. h264 preferred when available (matches
  // pickTranscodeVideoCodec's own reasoning: the universal, most-optimized
  // baseline every hardware encoder family supports) over whichever codec
  // happened to sort first — av1_nvenc scoring much lower than a real
  // h264_nvenc would is a property of AV1 hardware encoding, not a
  // meaningful signal about this server's real transcode headroom.
  const HW_SUFFIXES = ["_nvenc", "_qsv", "_vaapi", "_amf"] as const;
  const hwEncoder = HW_SUFFIXES.map((s) => `h264${s}`).find((n) => server.videoEncoders.includes(n))
    ?? server.videoEncoders.find((n) => HW_SUFFIXES.some((s) => n.endsWith(s)));
  if (hwEncoder) {
    const rc = hwEncoder.endsWith("_nvenc") ? ["-rc", "vbr", "-cq", "23"]
      : hwEncoder.endsWith("_qsv") ? ["-global_quality", "23"]
      : hwEncoder.endsWith("_vaapi") ? ["-rc_mode", "CQP", "-qp", "23"]
      : ["-rc", "cqp", "-qp_i", "23", "-qp_p", "23"]; // _amf
    profiles.push(await runProfile(
      "hardware_4k",
      `Matériel 4K (${hwEncoder})`,
      hwEncoder,
      true,
      [
        "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", `color=c=gray:s=3840x2160:r=24:d=${TEST_DURATION_SEC}`,
        "-c:v", hwEncoder, ...rc, ...GOP_ARGS,
        "-pix_fmt", "yuv420p", "-f", "null", "-",
      ]
    ));
  }

  const result: ServerBenchmarkResult = {
    ranAt: Date.now(),
    durationMs: Date.now() - start,
    appVersion: currentAppVersion(),
    hardwareAcceleration: server.hardwareAcceleration as ServerBenchmarkResult["hardwareAcceleration"],
    profiles,
  };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, result);
  return result;
}

export function readServerBenchmark(): ServerBenchmarkResult | null {
  return readJsonCached<ServerBenchmarkResult | null>(FILE, null);
}

/**
 * Called once at boot (instrumentation.ts). True when no benchmark has ever
 * run, OR the last one ran under a different app version — the update
 * either just installed (new version, no benchmark for it yet) or this is
 * a first boot. Deliberately does NOT compare timestamps/uptime — a
 * version bump is the actual signal an update happened, not "it's been a
 * while", which the monthly scheduled task already covers separately.
 */
export function shouldAutoRunBenchmark(): boolean {
  const last = readServerBenchmark();
  return !last || last.appVersion !== currentAppVersion();
}


export function benchmarkRealtimeFactor(profileId: string): number | null {
  const profile = readServerBenchmark()?.profiles.find((p) => p.id === profileId);
  return profile?.realtimeFactor ?? null;
}

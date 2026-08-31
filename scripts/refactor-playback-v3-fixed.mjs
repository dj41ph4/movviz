// Replacement migration helper for playback-v3. The earlier helper is intentionally not executed.
import fs from 'node:fs';

function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s,'utf8')}
function mustReplace(s, from, to, label){if(!s.includes(from)) throw new Error(`missing ${label}`); return s.replace(from,to)}

{
  const p='src/lib/playback/engine/playbackPlan.ts'; let s=read(p);
  s=s.replace('  | "PLEX_FALLBACK"\n','');
  s=s.replace('  | "PLEX_FALLBACK_REQUESTED";','  | "MOVVIZ_TRANSCODER_UNAVAILABLE";');
  write(p,s);
}

{
  const p='src/lib/playback/engine/sessionManager.ts'; let s=read(p);
  s=s.replace('  plexFallbackUsed: boolean;\n','');
  s=s.replace('    plexFallbackUsed: input.mode === "PLEX_FALLBACK",\n','');
  s=s.replace('  if (nextMode === "PLEX_FALLBACK") session.plexFallbackUsed = true;\n','');
  write(p,s);
}

{
  const p='src/lib/playback/engine/decidePlayback.ts'; let s=read(p);
  s=s.replace('import type { ServerPlaybackCapabilities } from "./serverCapabilities";','import type { ServerPlaybackCapabilities } from "./serverCapabilities";\nimport type { ServerBenchmarkResult } from "./serverBenchmark";');
  s=s.replace('  network?: { maxBitrateKbps?: number };\n','  network?: { maxBitrateKbps?: number };\n  /** Last real server benchmark. HDR→SDR is permitted only when the matching tonemap profile is >= 3x realtime. */\n  benchmark?: ServerBenchmarkResult | null;\n');
  const start='  // Absolute product rule (explicit instruction, 2026-08-24): HDR/DV content';
  const end='  const maxWidth = cap.maxWidth ?? client.maxWidth;';
  const a=s.indexOf(start), b=s.indexOf(end);
  if(a<0||b<0||b<=a) throw new Error('HDR block anchors');
  const hdrBlock=`  // HDR mismatch never forces a video transcode by itself. It only becomes\n  // an optional filter when a video transcode is already required AND the\n  // server benchmark proves the full HDR→SDR chain can sustain >=3x realtime.\n  let toneMapNeeded = false;\n  if (video.hdr) {\n    const supportedHdr = cap.hdr ?? [];\n    const directMatch = supportedHdr.includes(video.hdr.type);\n    const dvFallback = video.hdr.type === "dolby-vision" && video.hdr.dolbyVisionBaseLayerCompatibility && supportedHdr.includes(video.hdr.dolbyVisionBaseLayerCompatibility);\n    if (!directMatch && !dvFallback) {\n      reasons.push(video.hdr.type === "dolby-vision" ? "DOLBY_VISION_UNSUPPORTED" : "HDR_UNSUPPORTED");\n      toneMapNeeded = true;\n    }\n  }\n`;
  s=s.slice(0,a)+hdrBlock+s.slice(b);
  const needle='  const subtitleAction = decideSubtitleAction(subtitleTrack, client);\n\n  reasons.push(...videoCheck.reasons, ...audioCheck.reasons);';
  const repl='  const subtitleAction = decideSubtitleAction(subtitleTrack, client);\n  const toneMapBenchmark = input.benchmark?.profiles.find((p) => p.id === "software_720p_tonemap");\n  const toneMapAllowed = videoCheck.toneMapNeeded === true && (toneMapBenchmark?.realtimeFactor ?? 0) >= 3;\n\n  reasons.push(...videoCheck.reasons, ...audioCheck.reasons);';
  s=mustReplace(s,needle,repl,'tonemap benchmark insertion');
  s=s.replaceAll('pickVideoEncoderImpl(targetVideoCodec, server, videoCheck.toneMapNeeded === true)','pickVideoEncoderImpl(targetVideoCodec, server, toneMapAllowed)');
  s=s.replaceAll('pickTargetVideoWidth(media.video.width, clientMaxWidth, encoder.isHardware, videoCheck.toneMapNeeded === true)','pickTargetVideoWidth(media.video.width, clientMaxWidth, encoder.isHardware, toneMapAllowed)');
  s=s.replace('toneMap: videoCheck.toneMapNeeded || undefined,','toneMap: toneMapAllowed || undefined,');
  s=s.replaceAll('mode: "PLEX_FALLBACK",','mode: "UNSUPPORTED",');
  s=s.replaceAll('"PLEX_FALLBACK_REQUESTED"','"MOVVIZ_TRANSCODER_UNAVAILABLE"');
  s=s.replace(' * Not wired into the live player yet (that\'s Phase 9+); nothing calls this\n * except its own tests (decidePlayback.test.ts) today.\n',' * This is the live decision engine used by /api/playback/prepare.\n');
  write(p,s);
}

{
  const p='src/app/api/playback/prepare/route.ts'; let s=read(p);
  s=s.replace('import type { ClientPlaybackProfile } from "@/lib/playback/engine/clientProfile";','import type { ClientPlaybackProfile } from "@/lib/playback/engine/clientProfile";\nimport { readServerBenchmark } from "@/lib/playback/engine/serverBenchmark";');
  s=s.replace('  const plan = decidePlayback({ media, client: clientProfile, server, selectedAudio: audioTrack, selectedSubtitle: subtitleTrack, quality });','  const benchmark = readServerBenchmark();\n  const plan = decidePlayback({ media, client: clientProfile, server, benchmark, selectedAudio: audioTrack, selectedSubtitle: subtitleTrack, quality });');
  write(p,s);
}

{
  const p='src/lib/playback/engine/mediaRuntime.ts';
  write(p,`import fs from "node:fs";\nimport path from "node:path";\n\nfunction bundledBin(name: "ffmpeg" | "ffprobe"): string | null {\n  const exe = process.platform === "win32" ? ".exe" : "";\n  const candidates = [\n    path.join(process.cwd(), "runtime", "media", name + exe),\n    path.join(process.cwd(), "..", "runtime", "media", name + exe),\n    path.join(process.execPath ? path.dirname(process.execPath) : process.cwd(), "media", name + exe),\n  ];\n  return candidates.find((p) => fs.existsSync(p)) ?? null;\n}\n\nexport function resolveFfmpegBin(): string {\n  return process.env.MOVVIZ_FFMPEG_PATH?.trim() || bundledBin("ffmpeg") || "ffmpeg";\n}\n\nexport function resolveFfprobeBin(): string {\n  return process.env.MOVVIZ_FFPROBE_PATH?.trim() || bundledBin("ffprobe") || "ffprobe";\n}\n`);
  for (const p of ['src/lib/playback/engine/mediaProbe.ts','src/lib/playback/engine/serverBenchmark.ts','src/lib/playback/engine/localExecutor.ts']) {
    let s=read(p);
    if(p.endsWith('mediaProbe.ts')) {
      s=s.replace('import type { AudioTrack, HdrType, MediaDescriptor, SubtitleTrack, SubtitleTrackType } from "./mediaDescriptor";','import type { AudioTrack, HdrType, MediaDescriptor, SubtitleTrack, SubtitleTrackType } from "./mediaDescriptor";\nimport { resolveFfprobeBin } from "./mediaRuntime";');
      s=s.replace(/function ffprobeBin\(\): string \{[\s\S]*?\n\}/,'function ffprobeBin(): string { return resolveFfprobeBin(); }');
    } else {
      const anchor=p.endsWith('serverBenchmark.ts')?'import { detectServerCapabilities } from "./serverCapabilities.detect";':'import { MAX_CONCURRENT_TRANSCODES, totalActiveTranscodeSessions } from "./sharedTranscodeLimit";';
      s=s.replace(anchor,anchor+'\nimport { resolveFfmpegBin } from "./mediaRuntime";');
      s=s.replace(/function ffmpegBin\(\): string \{[\s\S]*?\n\}/,'function ffmpegBin(): string { return resolveFfmpegBin(); }');
    }
    write(p,s);
  }
}

{
  const p='packaging/windows/installer/movviz-service.xml'; let s=read(p);
  const anchor='  <env name="MOVVIZ_DATA_DIR" value="%ProgramData%\\Movviz\\data"/>\n';
  s=mustReplace(s,anchor,anchor+'  <env name="MOVVIZ_FFMPEG_PATH" value="%BASE%\\..\\runtime\\media\\ffmpeg.exe"/>\n  <env name="MOVVIZ_FFPROBE_PATH" value="%BASE%\\..\\runtime\\media\\ffprobe.exe"/>\n','windows env anchor');
  write(p,s);
}

{
  const p='packaging/windows/installer/build.ps1'; let s=read(p);
  const anchor='# Runtime = local node.exe\nCopy-Item -Force $nodeExe (Join-Path $stage "runtime\\node.exe")\n';
  const block=`# Runtime = local node.exe\nCopy-Item -Force $nodeExe (Join-Path $stage "runtime\\node.exe")\n\n# Media runtime = ffmpeg + ffprobe bundled with the service. The player, probe\n# and benchmark must not depend on the interactive user's PATH.\nStep "Staging FFmpeg media runtime"\n$mediaRuntime = Join-Path $stage "runtime\\media"\nNew-Item -ItemType Directory -Force $mediaRuntime | Out-Null\n$ffZip = Join-Path $stage ".tools\\ffmpeg.zip"\n$ffExtract = Join-Path $stage ".tools\\ffmpeg"\ntry {\n  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12\n  Invoke-WebRequest -Uri "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip" -OutFile $ffZip -UseBasicParsing\n  if (Test-Path $ffExtract) { Remove-Item $ffExtract -Recurse -Force }\n  Expand-Archive -Path $ffZip -DestinationPath $ffExtract -Force\n  $ffmpegExe = Get-ChildItem -Recurse -Filter "ffmpeg.exe" $ffExtract | Select-Object -First 1\n  $ffprobeExe = Get-ChildItem -Recurse -Filter "ffprobe.exe" $ffExtract | Select-Object -First 1\n  if (-not $ffmpegExe -or -not $ffprobeExe) { throw "ffmpeg.exe/ffprobe.exe missing from archive" }\n  Copy-Item -Force $ffmpegExe.FullName (Join-Path $mediaRuntime "ffmpeg.exe")\n  Copy-Item -Force $ffprobeExe.FullName (Join-Path $mediaRuntime "ffprobe.exe")\n  & (Join-Path $mediaRuntime "ffmpeg.exe") -version | Select-Object -First 1\n  & (Join-Path $mediaRuntime "ffprobe.exe") -version | Select-Object -First 1\n} finally {\n  if (Test-Path $ffZip) { Remove-Item -Force $ffZip }\n  if (Test-Path $ffExtract) { Remove-Item $ffExtract -Recurse -Force }\n}\n`;
  s=mustReplace(s,anchor,block,'windows runtime block');
  write(p,s);
}

{
  const p='scripts/decide-playback.test.ts'; let s=read(p);
  s=s.replace('test("§61: Plex is never chosen while ffmpeg is available, even when a transcode is required",','test("§61: Movviz transcode is chosen while ffmpeg is available",');
  s=s.replace('  assert.notEqual(plan.mode, "PLEX_FALLBACK");\n','');
  const old=`test("§61: Plex is only chosen once ffmpeg itself is unavailable", () => {\n  const plan = decidePlayback({\n    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),\n    client: client({ videoCapabilities: [{ codec: "h264" }] }),\n    server: FFMPEG_DOWN,\n  });\n  assert.equal(plan.mode, "PLEX_FALLBACK");\n  assert.ok(plan.reasons.includes("FFMPEG_UNAVAILABLE"));\n  assert.ok(plan.reasons.includes("PLEX_FALLBACK_REQUESTED"));\n});`;
  const neu=`test("§61: ffmpeg unavailable never delegates transcoding to Plex", () => {\n  const plan = decidePlayback({\n    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),\n    client: client({ videoCapabilities: [{ codec: "h264" }] }),\n    server: FFMPEG_DOWN,\n  });\n  assert.equal(plan.mode, "UNSUPPORTED");\n  assert.ok(plan.reasons.includes("FFMPEG_UNAVAILABLE"));\n  assert.ok(plan.reasons.includes("MOVVIZ_TRANSCODER_UNAVAILABLE"));\n});`;
  s=mustReplace(s,old,neu,'ffmpeg unavailable test');
  s += `\n\ntest("selected compatible AAC track ignores an unselected DTS track — no useless audio transcode", () => {\n  const plan = decidePlayback({\n    media: media({\n      container: "mov,mp4,m4a",\n      video: { index: 0, codec: "hevc", width: 1920, height: 1080 },\n      audioTracks: [\n        { index: 1, codec: "aac", language: "fra", channels: 2, default: true, forced: false },\n        { index: 2, codec: "dts", language: "eng", channels: 6, default: false, forced: false },\n      ],\n    }),\n    client: client({ containers:["mp4"], videoCapabilities:[{codec:"hevc"}], audioCapabilities:[{codec:"aac", decode:true}] }),\n    server: FFMPEG_OK,\n    selectedAudio: 1,\n  });\n  assert.equal(plan.mode, "DIRECT_PLAY");\n  assert.equal(plan.videoAction, "COPY");\n  assert.equal(plan.audioAction, "COPY");\n});\n\ntest("selecting the DTS track transcodes audio only and still copies video", () => {\n  const plan = decidePlayback({\n    media: media({\n      container: "mov,mp4,m4a",\n      video: { index: 0, codec: "hevc", width: 1920, height: 1080 },\n      audioTracks: [\n        { index: 1, codec: "aac", language: "fra", channels: 2, default: true, forced: false },\n        { index: 2, codec: "dts", language: "eng", channels: 6, default: false, forced: false },\n      ],\n    }),\n    client: client({ containers:["mp4"], videoCapabilities:[{codec:"hevc"}], audioCapabilities:[{codec:"aac", decode:true}] }),\n    server: FFMPEG_OK,\n    selectedAudio: 2,\n  });\n  assert.equal(plan.mode, "DIRECT_STREAM");\n  assert.equal(plan.videoAction, "COPY");\n  assert.equal(plan.audioAction, "TRANSCODE");\n});\n\ntest("HDR to SDR tonemap is enabled only when the real benchmark is >= 3x and video already needs transcoding", () => {\n  const base = {\n    media: media({ video: { index:0, codec:"h264", width:3840, height:2160, hdr:{type:"hdr10"} }, audioTracks:[{index:1,codec:"aac",channels:2,default:true,forced:false}] }),\n    client: client({ videoCapabilities:[{codec:"h264", maxWidth:1920, hdr:["sdr"]}], audioCapabilities:[{codec:"aac",decode:true}] }),\n    server: FFMPEG_OK,\n  };\n  const mkBench=(factor)=>({ranAt:0,durationMs:0,appVersion:"x",hardwareAcceleration:{nvenc:false,qsv:false,vaapi:false,amf:false,videotoolbox:false},profiles:[{id:"software_720p_tonemap",label:"",encoderImpl:"libx264",isHardware:false,realtimeFactor:factor,error:null}]});\n  const slow = decidePlayback({ ...base, benchmark:mkBench(2.99) });\n  assert.equal(slow.toneMap, undefined);\n  const fast = decidePlayback({ ...base, benchmark:mkBench(3) });\n  assert.equal(fast.toneMap, true);\n});\n`;
  write(p,s);
}

console.log('playback-v3 fixed patch applied');

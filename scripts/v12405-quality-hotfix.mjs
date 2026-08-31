import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(content, from, to, label) {
  const first = content.indexOf(from);
  if (first < 0) throw new Error(`missing patch anchor: ${label}`);
  if (content.indexOf(from, first + from.length) >= 0) throw new Error(`ambiguous patch anchor: ${label}`);
  return content.slice(0, first) + to + content.slice(first + from.length);
}

// ---------------------------------------------------------------------------
// Planner: explicit quality is a real playback constraint, not UI decoration.
// ---------------------------------------------------------------------------
{
  const path = "src/lib/playback/engine/decidePlayback.ts";
  let s = read(path);

  const subtitleSelector = `function selectSubtitleTrack(media: MediaDescriptor, selectedIndex: number | null | undefined): SubtitleTrack | null {\n  if (selectedIndex === null || selectedIndex === undefined) return null;\n  return media.subtitleTracks.find((t) => t.index === selectedIndex) ?? null;\n}\n`;
  const subtitleSelectorWithQuality = `${subtitleSelector}\nconst QUALITY_MAX_WIDTH: Partial<Record<NonNullable<DecidePlaybackInput["quality"]>, number>> = {\n  "4k": 3840,\n  "1440p": 2560,\n  "1080p": 1920,\n  "720p": 1280,\n};\n\nfunction requestedQualityMaxWidth(quality: DecidePlaybackInput["quality"]): number | undefined {\n  if (!quality || quality === "auto" || quality === "original") return undefined;\n  return QUALITY_MAX_WIDTH[quality];\n}\n`;
  s = replaceOnce(s, subtitleSelector, subtitleSelectorWithQuality, "quality width helper");

  const checks = `  const containerOk = isContainerCompatible(media.container, client);\n  const subtitleAction = decideSubtitleAction(subtitleTrack, client);\n\n  reasons.push(...videoCheck.reasons, ...audioCheck.reasons);`;
  const checksWithQuality = `  const containerOk = isContainerCompatible(media.container, client);\n  const subtitleAction = decideSubtitleAction(subtitleTrack, client);\n  const forcedQualityMaxWidth = requestedQualityMaxWidth(input.quality);\n  // A user-selected lower quality is an explicit request to encode the VIDEO\n  // to that ceiling. It is independent from codec compatibility: a perfectly\n  // decodable 4K H.264 source still becomes a 1080p transcode when the user\n  // asks for 1080p. Conversely, selecting 4K for a 1080p source never\n  // upscales and therefore does not force a transcode.\n  const forcedQualityDownscale = !!forcedQualityMaxWidth && !!media.video.width && media.video.width > forcedQualityMaxWidth;\n\n  reasons.push(...videoCheck.reasons, ...audioCheck.reasons);\n  if (forcedQualityDownscale) reasons.push("FORCED_QUALITY");`;
  s = replaceOnce(s, checks, checksWithQuality, "forced quality decision");

  s = replaceOnce(
    s,
    `  const needsVideoTranscode = !videoCheck.compatible || subtitleAction === "BURN" || videoCheck.toneMapNeeded === true;`,
    `  const needsVideoTranscode = !videoCheck.compatible || subtitleAction === "BURN" || videoCheck.toneMapNeeded === true || forcedQualityDownscale;`,
    "quality forces video transcode"
  );

  const widthBlock = `    let targetVideoWidth = pickTargetVideoWidth(media.video.width, clientMaxWidth, encoder.isHardware, videoCheck.toneMapNeeded === true);\n    if (!encoder.isHardware && softwareFactor !== null && softwareFactor < 1.5 && media.video.width && media.video.width > 1280) {\n      targetVideoWidth = Math.min(targetVideoWidth ?? media.video.width, 1280);\n    }\n    return {`;
  const widthBlockWithQuality = `    let targetVideoWidth = pickTargetVideoWidth(media.video.width, clientMaxWidth, encoder.isHardware, videoCheck.toneMapNeeded === true);\n    if (!encoder.isHardware && softwareFactor !== null && softwareFactor < 1.5 && media.video.width && media.video.width > 1280) {\n      targetVideoWidth = Math.min(targetVideoWidth ?? media.video.width, 1280);\n    }\n    // Explicit quality is another DOWNscale ceiling, never an upscale. It\n    // composes with safety/client caps by taking the smallest width.\n    if (forcedQualityDownscale && forcedQualityMaxWidth && media.video.width) {\n      targetVideoWidth = Math.min(targetVideoWidth ?? media.video.width, forcedQualityMaxWidth);\n    }\n    return {`;
  s = replaceOnce(s, widthBlock, widthBlockWithQuality, "quality target width");

  write(path, s);
}

// ---------------------------------------------------------------------------
// Desktop player: quality changes must re-plan engine-v2, never fall through
// the legacy remux/Plex HLS quality paths in auto/stable/beta.
// ---------------------------------------------------------------------------
{
  const path = "src/components/player/VideoPlayer.tsx";
  let s = read(path);

  const formatAnchor = `function formatTime(seconds: number): string {\n  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";\n  const h = Math.floor(seconds / 3600);\n  const m = Math.floor((seconds % 3600) / 60);\n  const s = Math.floor(seconds % 60);\n  if (h > 0) return \`${"${h}:${String(m).padStart(2, \"0\")}:${String(s).padStart(2, \"0\")}"}\`;\n  return \`${"${m}:${String(s).padStart(2, \"0\")}"}\`;\n}\n`;
  const helper = `${formatAnchor}\ntype PlannerQuality = "original" | "auto" | "4k" | "1440p" | "1080p" | "720p";\ninterface UnifiedPlaybackOverrides {\n  audioTrack?: number;\n  subtitleTrack?: number | null;\n  quality?: PlannerQuality;\n}\nfunction toPlannerQuality(quality: FfmpegQuality): PlannerQuality {\n  switch (quality) {\n    case "4k": return "4k";\n    case "2k": return "1440p";\n    case "fhd": return "1080p";\n    case "hd": return "720p";\n    default: return "original";\n  }\n}\n`;
  s = replaceOnce(s, formatAnchor, helper, "planner quality mapping");

  s = replaceOnce(
    s,
    `  const tryStartFfmpegRemuxRef = useRef<((info: StreamInfo, seekTo?: number) => Promise<boolean>) | null>(null);`,
    `  const tryStartFfmpegRemuxRef = useRef<((info: StreamInfo, seekTo?: number) => Promise<boolean>) | null>(null);\n  const tryStartUnifiedEngineRef = useRef<((seekTo?: number, overrides?: UnifiedPlaybackOverrides) => Promise<boolean>) | null>(null);`,
    "unified engine restart ref"
  );

  s = replaceOnce(
    s,
    `        body: JSON.stringify({ mediaId: movvizId ?? playbackId, ratingKey: hasRealPlexLink ? ratingKey : "", clientProfile, audioTrack, subtitleTrack, audioLanguage: localeRef.current }),`,
    `        body: JSON.stringify({ mediaId: movvizId ?? playbackId, ratingKey: hasRealPlexLink ? ratingKey : "", clientProfile, audioTrack, subtitleTrack, audioLanguage: localeRef.current, quality: toPlannerQuality(qualityRef.current) }),`,
    "track replan preserves quality"
  );

  s = replaceOnce(
    s,
    `    const tryStartLocalEngine = async (seekTo?: number): Promise<boolean> => {`,
    `    const tryStartLocalEngine = async (seekTo?: number, overrides: UnifiedPlaybackOverrides = {}): Promise<boolean> => {`,
    "unified engine signature"
  );

  s = replaceOnce(
    s,
    `          body: JSON.stringify({ mediaId: movvizId ?? playbackId, ratingKey: hasRealPlexLink ? ratingKey : "", clientProfile, audioLanguage: localeRef.current }),`,
    `          body: JSON.stringify({\n            mediaId: movvizId ?? playbackId,\n            ratingKey: hasRealPlexLink ? ratingKey : "",\n            clientProfile,\n            audioLanguage: localeRef.current,\n            audioTrack: overrides.audioTrack,\n            subtitleTrack: overrides.subtitleTrack,\n            quality: overrides.quality ?? toPlannerQuality(qualityRef.current),\n          }),`,
    "unified prepare quality/track overrides"
  );

  const startIndex = s.indexOf(`    const tryStartLocalEngine = async`);
  if (startIndex < 0) throw new Error("missing tryStartLocalEngine after signature patch");
  const sessionMarker = `\n    let sessionReady = false;`;
  const sessionIndex = s.indexOf(sessionMarker, startIndex);
  if (sessionIndex < 0) throw new Error("missing sessionReady after tryStartLocalEngine");
  s = s.slice(0, sessionIndex) + `\n    tryStartUnifiedEngineRef.current = tryStartLocalEngine;\n` + s.slice(sessionIndex);

  const oldHandler = `  const handleQualityChange = (mw: number | null) => {\n    const preset = QUALITY_PRESETS.find((p) => p.maxWidth === mw) ?? QUALITY_PRESETS[0];\n    qualityMaxWidthRef.current = mw;\n    qualityRef.current = preset.quality;\n    setMenuOpen(null);\n    if (ffmpegEngineRef.current) {\n      // Leg ffmpeg : reload local avec le nouveau profil, position conservée.\n      void reloadFfmpeg(currentAudio, preset.quality);\n      return;\n    }\n    if (hlsRef.current) {\n      // Leg HLS (option manuelle) : le transcode Plex reçoit maxWidth.\n      reloadHls(currentAudio, currentSubtitle);\n      return;\n    }\n    // Legs copy (direct/MSE) : un downscale exige un encode — on bascule sur\n    // le transcode ffmpeg LOCAL (plus jamais HLS par défaut), position\n    // conservée via un seek après chargement. "original" repart en leg copy.\n    if (mseEngineRef.current || directMode) {\n      if (mseEngineRef.current) {\n        try { mseEngineRef.current.destroy(); } catch { /* ignore */ }\n        mseEngineRef.current = null;\n        mseSkippedRef.current = true;\n        setMseActive(false);\n        setMseStats(null);\n      }\n      fallbackGuardRef.current = false;\n      setUsingFallback(false);\n      setDirectMode(false);\n      setBuffering(true);\n      const el = videoRef.current;\n      const pos = el && el.currentTime > 0 ? el.currentTime : undefined;\n      void (async () => {\n        if (await tryStartFfmpegRemuxRef.current?.(infoRef.current, undefined)) {\n          if (pos && pos > 0) await ffmpegEngineRef.current?.seek(pos);\n        } else {\n          maybeStartHls(undefined, true);\n        }\n      })();\n      return;\n    }\n    maybeStartHls(undefined, true);\n  };`;

  const newHandler = `  const handleQualityChange = (mw: number | null) => {\n    const preset = QUALITY_PRESETS.find((p) => p.maxWidth === mw) ?? QUALITY_PRESETS[0];\n    qualityMaxWidthRef.current = mw;\n    qualityRef.current = preset.quality;\n    setMenuOpen(null);\n\n    // Normal playback (auto/stable/beta): quality is a FIRST-CLASS v2\n    // PlaybackPlan constraint. Never send a quality change through the old\n    // remux leg or Plex HLS — that path can copy the original HEVC bitstream\n    // and then fail in the browser, which is exactly the v1.24.04 regression.\n    const b = betaRef.current;\n    const unifiedSelected = b.enabled && (b.playbackEngine === "auto" || b.playbackEngine === "stable" || b.playbackEngine === "beta") && !!playbackId;\n    if (unifiedSelected && tryStartUnifiedEngineRef.current) {\n      const currentEngine = ffmpegEngineRef.current;\n      const relative = videoRef.current?.currentTime ?? 0;\n      const position = ffmpegActiveRef.current && currentEngine ? currentEngine.seekBase + relative : relative;\n      const toIndex = (id: string | null, streams: StreamTrack[], tracks: { index: number }[]): number | undefined => {\n        if (id === null) return undefined;\n        const ordinal = streams.findIndex((stream) => stream.id === id);\n        return ordinal >= 0 ? tracks[ordinal]?.index : undefined;\n      };\n      const audioTrack = toIndex(currentAudio, audioStreams, localEngineAudioTracksRef.current);\n      const subtitleTrack = currentSubtitle === null ? null : toIndex(currentSubtitle, subtitleStreams, localEngineSubtitleTracksRef.current);\n\n      setError(null);\n      lastMediaErrorCodeRef.current = null;\n      setOptimizing(true);\n      setBuffering(true);\n      fallbackGuardRef.current = false;\n      setUsingFallback(false);\n      setDirectMode(false);\n\n      if (mseEngineRef.current) {\n        try { mseEngineRef.current.destroy(); } catch { /* ignore */ }\n        mseEngineRef.current = null;\n        setMseActive(false);\n        setMseStats(null);\n      }\n      if (hlsRef.current) {\n        try { hlsRef.current.destroy(); } catch { /* ignore */ }\n        hlsRef.current = null;\n      }\n      if (dashRef.current) {\n        try { dashRef.current.reset(); } catch { /* ignore */ }\n        dashRef.current = null;\n      }\n      if (currentEngine) {\n        ffmpegEngineRef.current = null;\n        void currentEngine.destroy().catch(() => void 0);\n      }\n      ffmpegActiveRef.current = false;\n      isLocalEngineV2Ref.current = false;\n      setFfmpegActive(false);\n      setLocalEnginePlanInfo(null);\n      setFfmpegStats(null);\n\n      void (async () => {\n        const ok = await tryStartUnifiedEngineRef.current?.(position > 0 ? position : undefined, {\n          audioTrack,\n          subtitleTrack,\n          quality: toPlannerQuality(preset.quality),\n        });\n        if (!ok) {\n          setOptimizing(false);\n          setBuffering(false);\n          setError(tRef.current("player.betaError"));\n        }\n      })();\n      return;\n    }\n\n    // Explicit troubleshooting engines retain their legacy behavior. They\n    // are never selected by the normal Auto/Stable flow above.\n    if (ffmpegEngineRef.current) {\n      void reloadFfmpeg(currentAudio, preset.quality);\n      return;\n    }\n    if (hlsRef.current) {\n      reloadHls(currentAudio, currentSubtitle);\n      return;\n    }\n    if (mseEngineRef.current || directMode) {\n      if (mseEngineRef.current) {\n        try { mseEngineRef.current.destroy(); } catch { /* ignore */ }\n        mseEngineRef.current = null;\n        mseSkippedRef.current = true;\n        setMseActive(false);\n        setMseStats(null);\n      }\n      fallbackGuardRef.current = false;\n      setUsingFallback(false);\n      setDirectMode(false);\n      setBuffering(true);\n      const el = videoRef.current;\n      const pos = el && el.currentTime > 0 ? el.currentTime : undefined;\n      void (async () => {\n        if (await tryStartFfmpegRemuxRef.current?.(infoRef.current, undefined)) {\n          if (pos && pos > 0) await ffmpegEngineRef.current?.seek(pos);\n        } else {\n          maybeStartHls(undefined, true);\n        }\n      })();\n      return;\n    }\n    maybeStartHls(undefined, true);\n  };`;
  s = replaceOnce(s, oldHandler, newHandler, "quality handler unified replan");

  write(path, s);
}

// ---------------------------------------------------------------------------
// Regression tests: planner quality semantics + selected audio isolation.
// ---------------------------------------------------------------------------
{
  const path = "scripts/decide-playback.test.ts";
  let s = read(path);
  const marker = `// ── v1.24.05 — explicit quality is a unified planner constraint ──`;
  if (!s.includes(marker)) {
    s += `\n\n${marker}\n` + String.raw`test("quality 1080p forces a 4K-compatible source to TRANSCODE, never remux-copy HEVC/H264", () => {
  const plan = decidePlayback({
    media: media({
      container: "mov,mp4,m4a",
      video: { index: 0, codec: "h264", width: 3840, height: 2160, fps: 24 },
      audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true, forced: false }],
    }),
    client: client({
      containers: ["mp4"],
      videoCapabilities: [{ codec: "h264", maxWidth: 3840 }],
      audioCapabilities: [{ codec: "aac", decode: true }],
    }),
    server: FFMPEG_OK,
    quality: "1080p",
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.equal(plan.videoAction, "TRANSCODE");
  assert.equal(plan.targetVideoWidth, 1920);
  assert.equal(plan.audioAction, "COPY");
  assert.ok(plan.reasons.includes("FORCED_QUALITY"));
});

test("quality never upscales: asking 4K for a 1080p compatible source stays DIRECT_PLAY", () => {
  const plan = decidePlayback({
    media: media({
      container: "mov,mp4,m4a",
      video: { index: 0, codec: "h264", width: 1920, height: 1080, fps: 24 },
      audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true, forced: false }],
    }),
    client: client({ containers: ["mp4"], videoCapabilities: [{ codec: "h264", maxWidth: 3840 }], audioCapabilities: [{ codec: "aac", decode: true }] }),
    server: FFMPEG_OK,
    quality: "4k",
  });
  assert.equal(plan.mode, "DIRECT_PLAY");
  assert.equal(plan.targetVideoWidth, undefined);
  assert.ok(!plan.reasons.includes("FORCED_QUALITY"));
});

test("unsupported HEVC at original quality transcodes to a browser-supported codec instead of returning copied HEVC", () => {
  const plan = decidePlayback({
    media: media({
      container: "mov,mp4,m4a",
      video: { index: 0, codec: "hevc", width: 3840, height: 2160, fps: 24 },
      audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true, forced: false }],
    }),
    client: client({ containers: ["mp4"], videoCapabilities: [{ codec: "h264", maxWidth: 3840 }], audioCapabilities: [{ codec: "aac", decode: true }] }),
    server: FFMPEG_OK,
    quality: "original",
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.equal(plan.videoAction, "TRANSCODE");
  assert.equal(plan.targetVideoCodec, "h264");
});

test("selected French AAC stays COPY when English DTS exists but is unselected, even during requested video downscale", () => {
  const plan = decidePlayback({
    media: media({
      container: "mov,mp4,m4a",
      video: { index: 0, codec: "h264", width: 3840, height: 2160, fps: 24 },
      audioTracks: [
        { index: 1, codec: "aac", language: "fra", channels: 2, default: true, forced: false },
        { index: 2, codec: "dts", language: "eng", channels: 6, default: false, forced: false },
      ],
    }),
    client: client({ containers: ["mp4"], videoCapabilities: [{ codec: "h264", maxWidth: 3840 }], audioCapabilities: [{ codec: "aac", decode: true }] }),
    server: FFMPEG_OK,
    selectedAudio: 1,
    quality: "1080p",
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.equal(plan.videoAction, "TRANSCODE");
  assert.equal(plan.targetVideoWidth, 1920);
  assert.equal(plan.audioAction, "COPY");
  assert.ok(!plan.reasons.includes("AUDIO_CODEC_UNSUPPORTED"));
});
`;
    write(path, s);
  }
}

// Static wiring guard: prevents a later refactor from silently sending quality
// changes back through legacy remux/Plex paths while backend support remains.
{
  const path = "scripts/player-quality-replan.test.ts";
  write(path, `import assert from "node:assert/strict";\nimport { test } from "node:test";\nimport fs from "node:fs";\n\nconst source = fs.readFileSync("src/components/player/VideoPlayer.tsx", "utf8");\n\ntest("desktop unified prepare carries the active quality", () => {\n  assert.match(source, /quality: overrides\\.quality \\?\\? toPlannerQuality\\(qualityRef\\.current\\)/);\n  assert.match(source, /quality: toPlannerQuality\\(qualityRef\\.current\\)/);\n});\n\ntest("normal quality changes restart the unified engine with a planner quality override", () => {\n  assert.match(source, /tryStartUnifiedEngineRef\\.current\\?\\.\\(position > 0 \\? position : undefined, \\{/);\n  assert.match(source, /quality: toPlannerQuality\\(preset\\.quality\\)/);\n});\n`);
}

console.log("v1.24.05 quality hotfix applied");

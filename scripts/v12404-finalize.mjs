import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s, 'utf8'); };
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const replaceOnce = (s, from, to, label) => {
  const i = s.indexOf(from); must(i >= 0, `missing anchor: ${label}`);
  return s.slice(0, i) + to + s.slice(i + from.length);
};
const removeIfExists = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} };

// ---------------------------------------------------------------------------
// 1) Playback plan: one Movviz planner, no Plex-transcoder mode, selected track
//    is part of the plan, and remux also requires ffmpeg.
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/playback/engine/playbackPlan.ts';
  let s = read(p);
  s = s.replace('  | "PLEX_FALLBACK"\n', '');
  s = s.replace('  | "PLEX_FALLBACK_REQUESTED";', '  | "MOVVIZ_TRANSCODER_UNAVAILABLE"\n  | "AUDIO_TRACK_SELECTION_REQUIRED";');
  write(p, s);
}

{
  const p = 'src/lib/playback/engine/sessionManager.ts';
  let s = read(p);
  s = s.replace('  plexFallbackUsed: boolean;\n', '');
  s = s.replace('    plexFallbackUsed: false,\n', '');
  write(p, s);
}

{
  const p = 'src/lib/playback/engine/decidePlayback.ts';
  let s = read(p);
  const selAnchor = '  const audioTrack = selectAudioTrack(media, input.selectedAudio);\n  const subtitleTrack = selectSubtitleTrack(media, input.selectedSubtitle);\n';
  const selReplace = `  const audioTrack = selectAudioTrack(media, input.selectedAudio);\n  const subtitleTrack = selectSubtitleTrack(media, input.selectedSubtitle);\n  const defaultAudioTrack = media.audioTracks.find((t) => t.default) ?? media.audioTracks[0] ?? null;\n  // Direct raw-file playback cannot select a non-default audio stream. A user\n  // choosing (or preferring) another compatible stream therefore requires a\n  // cheap remux, never an audio/video transcode. This is also what prevents\n  // an unselected English DTS track from forcing work while French AAC is\n  // the track actually being listened to.\n  const needsAudioTrackSelection = input.selectedAudio !== undefined && !!audioTrack && !!defaultAudioTrack && audioTrack.index !== defaultAudioTrack.index;\n`;
  s = replaceOnce(s, selAnchor, selReplace, 'selected audio planning');
  const reasonAnchor = '  reasons.push(...videoCheck.reasons, ...audioCheck.reasons);\n  if (!containerOk) reasons.push("CONTAINER_UNSUPPORTED");\n';
  const reasonReplace = '  reasons.push(...videoCheck.reasons, ...audioCheck.reasons);\n  if (!containerOk) reasons.push("CONTAINER_UNSUPPORTED");\n  if (needsAudioTrackSelection) reasons.push("AUDIO_TRACK_SELECTION_REQUIRED");\n';
  s = replaceOnce(s, reasonAnchor, reasonReplace, 'selected track reason');
  s = s.replace('  const needsRemuxOnly = !containerOk && !needsVideoTranscode;', '  const needsRemuxOnly = (!containerOk || needsAudioTrackSelection) && !needsVideoTranscode;');
  const remuxAnchor = `  if (needsRemuxOnly) {\n    return {\n      mode: "REMUX",`;
  const remuxReplace = `  if (needsRemuxOnly) {\n    if (!server.ffmpegAvailable) {\n      return {\n        mode: "UNSUPPORTED",\n        containerAction: "REMUX",\n        targetContainer: "mp4",\n        videoAction: "COPY",\n        audioAction: "COPY",\n        subtitleAction,\n        reasons: [...reasons, "FFMPEG_UNAVAILABLE", "MOVVIZ_TRANSCODER_UNAVAILABLE"],\n      };\n    }\n    return {\n      mode: "REMUX",`;
  s = replaceOnce(s, remuxAnchor, remuxReplace, 'remux ffmpeg gate');
  s = s.replace('reasons: [...reasons, "FFMPEG_UNAVAILABLE"],', 'reasons: [...reasons, "FFMPEG_UNAVAILABLE", "MOVVIZ_TRANSCODER_UNAVAILABLE"],');
  // Use benchmark headroom to lower server cost instead of discovering an
  // underpowered software encode mid-playback.
  const encAnchor = `    const encoder = pickVideoEncoderImpl(targetVideoCodec, server, videoCheck.toneMapNeeded === true);\n    const targetCap = client.videoCapabilities.find((c) => normalizeCodecName(c.codec) === targetVideoCodec);\n    const clientMaxWidth = targetCap?.maxWidth ?? client.maxWidth;\n    return {`;
  const encReplace = `    const encoder = pickVideoEncoderImpl(targetVideoCodec, server, videoCheck.toneMapNeeded === true);\n    const softwareFactor = input.performance?.software1080pRealtimeFactor ?? null;\n    if (!encoder.isHardware && videoCheck.toneMapNeeded !== true && softwareFactor !== null && softwareFactor < 1.5) {\n      encoder.preset = "ultrafast";\n    }\n    const targetCap = client.videoCapabilities.find((c) => normalizeCodecName(c.codec) === targetVideoCodec);\n    const clientMaxWidth = targetCap?.maxWidth ?? client.maxWidth;\n    let targetVideoWidth = pickTargetVideoWidth(media.video.width, clientMaxWidth, encoder.isHardware, videoCheck.toneMapNeeded === true);\n    if (!encoder.isHardware && softwareFactor !== null && softwareFactor < 1.5 && media.video.width && media.video.width > 1280) {\n      targetVideoWidth = Math.min(targetVideoWidth ?? media.video.width, 1280);\n    }\n    return {`;
  s = replaceOnce(s, encAnchor, encReplace, 'benchmark adaptive software profile');
  s = s.replace('      targetVideoWidth: pickTargetVideoWidth(media.video.width, clientMaxWidth, encoder.isHardware, videoCheck.toneMapNeeded === true),', '      targetVideoWidth,');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 2) /prepare selects the REAL requested/preferred audio track before planning.
// ---------------------------------------------------------------------------
{
  const p = 'src/app/api/playback/prepare/route.ts';
  let s = read(p);
  if (!s.includes('findTrackForLocale')) {
    s = s.replace('import type { ClientPlaybackProfile } from "@/lib/playback/engine/clientProfile";', 'import type { ClientPlaybackProfile } from "@/lib/playback/engine/clientProfile";\nimport { findTrackForLocale } from "@/lib/library/detectLanguage";');
  }
  const trackAnchor = `  const server = await detectServerCapabilities();\n  const audioTrack = Number.isInteger(b.audioTrack) ? (b.audioTrack as number) : undefined;\n  const subtitleTrackRaw = b.subtitleTrack;`;
  const trackReplace = `  const server = await detectServerCapabilities();\n  let audioTrack = Number.isInteger(b.audioTrack) ? (b.audioTrack as number) : undefined;\n  const requestedAudioLanguage = typeof b.audioLanguage === "string" ? b.audioLanguage.trim().toLowerCase() : "";\n  if (audioTrack === undefined && requestedAudioLanguage) {\n    audioTrack = findTrackForLocale(media.audioTracks, requestedAudioLanguage)?.index;\n  }\n  const subtitleTrackRaw = b.subtitleTrack;`;
  s = replaceOnce(s, trackAnchor, trackReplace, 'prepare audio language selection');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 3) Transcoder: if video really must be encoded, build a controlled 1.5x
//    transcode-ahead instead of running flat-out for the whole movie.
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/playback/engine/transcoderExecutor.ts';
  let s = read(p);
  const inputAnchor = `  if (extractingSubtitle && opts.subtitleCharenc) args.push("-sub_charenc", opts.subtitleCharenc);\n  if (seekSec > 0 && !outputSeek) args.push("-ss", String(seekSec));\n  appendInputHeaders(args, input.headers);`;
  const inputReplace = `  if (extractingSubtitle && opts.subtitleCharenc) args.push("-sub_charenc", opts.subtitleCharenc);\n  if (seekSec > 0 && !outputSeek) args.push("-ss", String(seekSec));\n  // Video transcodes run slightly ahead of realtime, then naturally back-\n  // pressure against the HTTP/browser buffer. This keeps ~50% recovery\n  // margin without pegging a NAS CPU encoding the whole title as fast as\n  // possible. Remux/audio-only paths stay unrestricted because they cost\n  // almost nothing and should fill the client buffer immediately.\n  if (needsVideoTranscode) args.push("-readrate", "1.5");\n  appendInputHeaders(args, input.headers);`;
  s = replaceOnce(s, inputAnchor, inputReplace, 'transcode readrate');
  s = s.replace('partagé avec le moteur Plex', 'partagé entre les sessions média Movviz');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 4) Desktop: automatic player always uses the unified Movviz engine for both
//    local files and Plex RAW sources. No Plex transcoder fallback from it.
// ---------------------------------------------------------------------------
{
  const p = 'src/components/player/VideoPlayer.tsx';
  let s = read(p);
  // Unified engine request can resolve local or raw Plex source.
  s = s.replace('      if (!b.enabled || !engineSelected || !localPlayback || !movvizId) return false;', '      if (!b.enabled || !engineSelected || !playbackId) return false;');
  s = s.replace('          body: JSON.stringify({ mediaId: movvizId, clientProfile }),', '          body: JSON.stringify({ mediaId: movvizId ?? playbackId, ratingKey: hasRealPlexLink ? ratingKey : "", clientProfile, audioLanguage: localeRef.current }),');
  // Reload track path also supports Plex raw sources.
  s = s.replace('    if (!engine || !movvizId) {', '    if (!engine || !playbackId) {');
  s = s.replace('        body: JSON.stringify({ mediaId: movvizId, clientProfile, audioTrack, subtitleTrack }),', '        body: JSON.stringify({ mediaId: movvizId ?? playbackId, ratingKey: hasRealPlexLink ? ratingKey : "", clientProfile, audioTrack, subtitleTrack, audioLanguage: localeRef.current }),');

  // Let /prepare be the first and only strategy decision in auto/stable/beta.
  const afterInfo = '      } catch { /* ignore */ }\n\n      let strategy: "direct" | "transcode";';
  const afterInfoReplace = `      } catch { /* ignore */ }\n\n      const unifiedConfig = betaRef.current;\n      if (unifiedConfig.enabled && (unifiedConfig.playbackEngine === "auto" || unifiedConfig.playbackEngine === "stable" || unifiedConfig.playbackEngine === "beta")) {\n        if (await tryStartLocalEngine(seekTo)) return;\n        setBuffering(false);\n        setOptimizing(false);\n        setError(tRef.current("player.betaError"));\n        return;\n      }\n\n      let strategy: "direct" | "transcode";`;
  s = replaceOnce(s, afterInfo, afterInfoReplace, 'unified engine first');

  // Accept DIRECT_PLAY from the unified planner and play its exact source URL.
  s = s.replace('          stream: { url: string };', '          stream: { url: string };');
  const prepTypeOld = '          tracks?: { audio?: { index: number }[]; subtitle?: { index: number }[] };\n        };';
  const prepTypeNew = '          tracks?: { audio?: { index: number }[]; subtitle?: { index: number }[] };\n          stream: { url: string };\n        };';
  if (s.includes(prepTypeOld) && !s.includes('tracks?: { audio?: { index: number }[]; subtitle?: { index: number }[] };\n          stream: { url: string };')) {
    s = s.replace(prepTypeOld, prepTypeNew);
  }
  s = s.replace('        if (prep.plan.mode !== "REMUX" && prep.plan.mode !== "DIRECT_STREAM" && prep.plan.mode !== "TRANSCODE") return false;', '        if (prep.plan.mode !== "DIRECT_PLAY" && prep.plan.mode !== "REMUX" && prep.plan.mode !== "DIRECT_STREAM" && prep.plan.mode !== "TRANSCODE") return false;');

  const failureStart = `        const onLocalEngineFailure = () => {\n          destroyFfmpeg();\n          ffmpegSkippedRef.current = true;\n          if (hasRealPlexLink) {\n            setBuffering(true);\n            fallbackGuardRef.current = false;\n            maybeStartHls(undefined, true);\n          } else {\n            const isCodecFailure = lastMediaErrorCodeRef.current !== null && CODEC_MEDIA_ERROR_CODES.has(lastMediaErrorCodeRef.current);\n            setError(tRef.current(isCodecFailure ? "player.betaErrorCodec" : "player.betaError"));\n          }\n        };`;
  const failureNew = `        const onLocalEngineFailure = () => {\n          destroyFfmpeg();\n          ffmpegSkippedRef.current = true;\n          const isCodecFailure = lastMediaErrorCodeRef.current !== null && CODEC_MEDIA_ERROR_CODES.has(lastMediaErrorCodeRef.current);\n          setError(tRef.current(isCodecFailure ? "player.betaErrorCodec" : "player.betaError"));\n        };`;
  if (s.includes(failureStart)) s = s.replace(failureStart, failureNew);

  const beforeEngine = `        const engine = new FfmpegRemuxEngine(\n          {`;
  const directBranch = `        localEngineAudioTracksRef.current = prep.tracks?.audio ?? [];\n        localEngineSubtitleTracksRef.current = prep.tracks?.subtitle ?? [];\n\n        if (prep.plan.mode === "DIRECT_PLAY") {\n          destroyFfmpeg();\n          isLocalEngineV2Ref.current = false;\n          setDirectMode(true);\n          setBuffering(true);\n          if (seekTo && seekTo > 0) {\n            video.addEventListener("loadedmetadata", () => {\n              if (video.duration && seekTo < video.duration) video.currentTime = seekTo;\n            }, { once: true });\n          }\n          video.src = prep.stream.url;\n          video.load();\n          try { await video.play(); } catch { /* autoplay policy/user action will retry */ }\n          return true;\n        }\n\n        const engine = new FfmpegRemuxEngine(\n          {`;
  s = replaceOnce(s, beforeEngine, directBranch, 'unified direct branch');
  // Remove duplicate track-ref assignment later in the function.
  const duplicate = '        localEngineAudioTracksRef.current = prep.tracks?.audio ?? [];\n        localEngineSubtitleTracksRef.current = prep.tracks?.subtitle ?? [];\n        setFfmpegActive(true);';
  s = s.replace(duplicate, '        setFfmpegActive(true);');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 5) Player settings become a first-class tab; Plex keeps Plex-only settings.
// ---------------------------------------------------------------------------
{
  const p = 'src/components/settings/PlexSettings.tsx';
  let s = read(p);
  s = s.replace(', Play, MonitorPlay', ', Play');
  s = s.replace('import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";\n', '');
  s = s.replace('import { usePreferredAudioLanguage } from "@/lib/settings/usePreferredAudioLanguage";\n', '');
  s = s.replace('import { PREFERRED_AUDIO_LANGUAGES, type PreferredAudioLanguage } from "@/lib/userPrefs/languages";\n', '');
  s = s.replace('  const { adminEnabled: betaPlayer, streamCacheTtl, playbackEngine, setAdminEnabled: setBetaPlayer, setStreamCacheTtl, setPlaybackEngine } = useBetaPlayer();\n  const { value: preferredAudioLanguage, set: setPreferredAudioLanguage } = usePreferredAudioLanguage();\n', '');
  const start = s.indexOf('\n      <div className="mt-5 border-t border-white/8 pt-5">\n        <div className="mb-4 flex items-start gap-3">');
  const endMarker = '\n    </div>\n  );\n}\n\n/**\n * Allow the admin';
  const end = s.indexOf(endMarker);
  must(start >= 0 && end > start, 'Plex playback block anchors');
  s = s.slice(0, start) + '\n' + s.slice(end);
  write(p, s);
}

{
  const p = 'src/components/settings/PlayerSettings.tsx';
  write(p, `"use client";\n\nimport { MonitorPlay, Bug, Gauge } from "lucide-react";\nimport { useT } from "@/i18n/provider";\nimport { useCurrentUser } from "@/lib/auth/useCurrentUser";\nimport { useBetaPlayer } from "@/lib/settings/useBetaPlayer";\nimport { usePreferredAudioLanguage } from "@/lib/settings/usePreferredAudioLanguage";\nimport { PREFERRED_AUDIO_LANGUAGES, type PreferredAudioLanguage } from "@/lib/userPrefs/languages";\nimport { Toggle } from "@/components/ui/Toggle";\nimport { BenchmarkPanel } from "@/components/settings/BenchmarkPanel";\n\nexport function PlayerSettings() {\n  const t = useT();\n  const user = useCurrentUser();\n  const isAdmin = user?.role === "admin";\n  const { adminEnabled, userEnabled, streamCacheTtl, debug, setAdminEnabled, setUserEnabled, setStreamCacheTtl, setDebug } = useBetaPlayer();\n  const { value: preferredAudioLanguage, set: setPreferredAudioLanguage } = usePreferredAudioLanguage();\n\n  return (\n    <div className="space-y-6">\n      <div className="rounded-2xl glass p-5">\n        <div className="mb-5 flex items-start gap-3">\n          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/12 text-purple-400">\n            <MonitorPlay className="h-5 w-5" />\n          </span>\n          <div>\n            <h3 className="font-bold text-ink">{t("player.unifiedTitle")}</h3>\n            <p className="mt-0.5 text-xs text-ink-dim">{t("player.unifiedHint")}</p>\n          </div>\n        </div>\n\n        <div className="flex items-center justify-between gap-3">\n          <div>\n            <p className="text-sm font-semibold text-ink">{t("player.useMovviz")}</p>\n            <p className="text-xs text-ink-dim">{t("player.useMovvizHint")}</p>\n          </div>\n          <Toggle on={userEnabled} onChange={() => setUserEnabled(!userEnabled)} />\n        </div>\n\n        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">\n          <div>\n            <p className="text-sm font-semibold text-ink">{t("player.preferredAudioLanguage")}</p>\n            <p className="text-xs text-ink-dim">{t("player.preferredAudioLanguageHint")}</p>\n          </div>\n          <select value={preferredAudioLanguage} onChange={(e) => setPreferredAudioLanguage(e.target.value as PreferredAudioLanguage)} className="h-9 shrink-0 rounded-xl glass px-3 text-xs font-semibold text-ink outline-none focus:border-brand/40">\n            {PREFERRED_AUDIO_LANGUAGES.map((l) => <option key={l} value={l}>{t(\`player.audioLang.\${l}\`)}</option>)}\n          </select>\n        </div>\n\n        <div className="mt-4 rounded-xl border border-brand/15 bg-brand/5 p-3">\n          <p className="text-sm font-semibold text-ink">{t("player.autoEngine")}</p>\n          <p className="mt-1 text-xs leading-relaxed text-ink-dim">{t("player.autoEngineHint")}</p>\n        </div>\n      </div>\n\n      {isAdmin && (\n        <div className="rounded-2xl glass p-5">\n          <div className="mb-4 flex items-start gap-3">\n            <Gauge className="mt-0.5 h-5 w-5 text-brand-glow" />\n            <div><h3 className="font-bold text-ink">{t("player.serverTitle")}</h3><p className="text-xs text-ink-dim">{t("player.serverHint")}</p></div>\n          </div>\n          <div className="flex items-center justify-between gap-3">\n            <div><p className="text-sm font-semibold text-ink">{t("player.serverEnabled")}</p><p className="text-xs text-ink-dim">{t("player.serverEnabledHint")}</p></div>\n            <Toggle on={adminEnabled} onChange={() => setAdminEnabled(!adminEnabled)} />\n          </div>\n          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">\n            <div><p className="text-sm font-semibold text-ink">{t("player.bufferTtl")}</p><p className="text-xs text-ink-dim">{t("player.bufferTtlHint")}</p></div>\n            <div className="flex items-center gap-2"><input type="number" min={0} max={86400} value={streamCacheTtl} onChange={(e) => setStreamCacheTtl(parseInt(e.target.value) || 0)} className="h-9 w-24 rounded-xl glass px-3 text-xs text-ink outline-none" /><span className="text-xs text-ink-dim">s</span></div>\n          </div>\n          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-4">\n            <div className="flex items-start gap-2"><Bug className="mt-0.5 h-4 w-4 text-ink-dim" /><div><p className="text-sm font-semibold text-ink">{t("player.debugToggle")}</p><p className="text-xs text-ink-dim">{t("player.debugToggleHint")}</p></div></div>\n            <Toggle on={debug} onChange={() => setDebug(!debug)} />\n          </div>\n        </div>\n      )}\n\n      {isAdmin && <BenchmarkPanel />}\n    </div>\n  );\n}\n`);
}

{
  const p = 'src/app/settings/page.tsx';
  let s = read(p);
  s = s.replace('import { BenchmarkPanel } from "@/components/settings/BenchmarkPanel";\n', '');
  s = s.replace('import { PlexSettings } from "@/components/settings/PlexSettings";', 'import { PlexSettings } from "@/components/settings/PlexSettings";\nimport { PlayerSettings } from "@/components/settings/PlayerSettings";');
  s = s.replace('          {tab === "plex" && user?.role === "admin" && <PlexSettings />}\n', '          {tab === "player" && <PlayerSettings />}\n\n          {tab === "plex" && user?.role === "admin" && <PlexSettings />}\n');
  s = s.replace('              <BenchmarkPanel />\n', '');
  write(p, s);
}

{
  const p = 'src/lib/settingsNav.ts';
  let s = read(p);
  s = s.replace('  ServerCog,\n  type LucideIcon,', '  ServerCog,\n  MonitorPlay,\n  type LucideIcon,');
  const exp = '  { id: "experience", labelKey: "settings.tabExperience", hintKey: "settings.tabExperienceHint", icon: Wand2, group: "personal", journey: "experience", keywords: ["lecteur", "sous-titres", "lenteur lecture", "transcodage"] },\n';
  const player = exp + '  { id: "player", labelKey: "settings.tabPlayer", hintKey: "settings.tabPlayerHint", icon: MonitorPlay, group: "personal", journey: "playback", keywords: ["lecteur", "lecture", "transcodage", "audio", "codec", "ffmpeg", "benchmark", "buffer", "hdr", "sous-titres"] },\n';
  s = replaceOnce(s, exp, player, 'settings player tab');
  s = s.replace('{ id: "plex", labelKey: "settings.tabPlex", hintKey: "settings.tabPlexHint", icon: Play, group: "library", journey: "library", adminOnly: true, keywords: ["connexion", "serveur", "bibliothèque Plex", "lecture", "transcodage", "audio"] }', '{ id: "plex", labelKey: "settings.tabPlex", hintKey: "settings.tabPlexHint", icon: Play, group: "library", journey: "library", adminOnly: true, keywords: ["connexion", "serveur", "bibliothèque Plex", "synchronisation", "profils Plex"] }');
  s = s.replace('tabIds: ["plex", "experience", "performance"]', 'tabIds: ["player", "performance", "gpu"]');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 6) Settings migration: old engine choices normalize to unified AUTO. New
//    installs use the Movviz player by default; an explicit per-user opt-out
//    remains respected.
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/settings/betaPlayer.ts';
  let s = read(p);
  s = s.replace('  engineTierMigrated?: boolean;\n', '  engineTierMigrated?: boolean;\n  unifiedPlayerMigrated?: boolean;\n');
  s = s.replace('  enabled: false,', '  enabled: true,');
  s = s.replace('  engineTierMigrated: true,\n};', '  engineTierMigrated: true,\n  unifiedPlayerMigrated: true,\n};');
  const migrate = `  if (!raw.engineTierMigrated) {\n    cfg.playbackEngine = "auto";\n    cfg.engineTierMigrated = true;\n    save(cfg);\n  }\n  return cfg;`;
  const migrateNew = `  if (!raw.engineTierMigrated) {\n    cfg.playbackEngine = "auto";\n    cfg.engineTierMigrated = true;\n  }\n  if (!raw.unifiedPlayerMigrated) {\n    cfg.enabled = true;\n    cfg.playbackEngine = "auto";\n    cfg.unifiedPlayerMigrated = true;\n    save(cfg);\n  }\n  return cfg;`;
  s = replaceOnce(s, migrate, migrateNew, 'unified settings migration');
  s = s.replace('export function getPlaybackEngine(): EngineConfig {\n  const v = load().playbackEngine;\n  return isKnownEngine(v) ? v : "auto";\n}', 'export function getPlaybackEngine(): EngineConfig {\n  const cfg = load();\n  if (cfg.playbackEngine !== "auto") {\n    save({ ...cfg, playbackEngine: "auto" });\n  }\n  return "auto";\n}');
  s = s.replace('export function setPlaybackEngine(engine: EngineConfig): void {\n  const cfg = load();\n  save({ ...cfg, playbackEngine: isKnownEngine(engine) ? engine : "auto" });\n}', 'export function setPlaybackEngine(_engine: EngineConfig): void {\n  const cfg = load();\n  save({ ...cfg, playbackEngine: "auto" });\n}');
  write(p, s);
}

{
  const p = 'src/lib/settings/useBetaPlayer.ts';
  let s = read(p);
  s = s.replace('  const userEnabled = prefsData?.prefs?.betaPlayerEnabled ?? false;', '  const userEnabled = prefsData?.prefs?.betaPlayerEnabled ?? true;');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 7) i18n — Player is a real settings destination in all five UI languages.
// ---------------------------------------------------------------------------
const localeStrings = {
  fr: {
    tab: 'Lecteur', tabHint: 'Lecture directe, transcodage Movviz, audio, buffer et diagnostic.',
    unifiedTitle: 'Lecteur Movviz', unifiedHint: 'Un seul moteur choisit automatiquement l’opération minimale nécessaire pour lire le média.',
    useMovviz: 'Utiliser le lecteur Movviz', useMovvizHint: 'Lecture directe quand possible, sinon remux ou transcodage Movviz selon les capacités réelles de cet appareil.',
    autoEngine: 'Moteur automatique unifié', autoEngineHint: 'Plus de cascade MSE/HLS/Plex : le planner choisit Direct, vidéo copiée + audio adapté, ou transcodage vidéo uniquement si nécessaire.',
    serverTitle: 'Moteur média du serveur', serverHint: 'Paramètres communs à Windows, Linux x64 et Linux ARM64/NAS.',
    serverEnabled: 'Activer le lecteur Movviz sur cette instance', serverEnabledHint: 'Active le moteur unifié pour les profils qui ne l’ont pas désactivé individuellement.',
    bufferTtl: 'Réserve/cache de lecture', bufferTtlHint: 'Durée de conservation utilisée par les mécanismes de lecture et de reprise.',
    debugToggle: 'Diagnostic du lecteur', debugToggleHint: 'Affiche les décisions codec, copie/transcodage, buffer et erreurs utiles au diagnostic.'
  },
  en: {
    tab: 'Player', tabHint: 'Direct play, Movviz transcoding, audio, buffering and diagnostics.', unifiedTitle: 'Movviz Player', unifiedHint: 'One engine automatically chooses the smallest operation required to play the media.', useMovviz: 'Use the Movviz player', useMovvizHint: 'Direct play when possible, otherwise remux or Movviz transcode based on this device’s real capabilities.', autoEngine: 'Unified automatic engine', autoEngineHint: 'No MSE/HLS/Plex cascade: the planner chooses Direct, video copy + audio adaptation, or video transcode only when required.', serverTitle: 'Server media engine', serverHint: 'Shared settings for Windows, Linux x64 and Linux ARM64/NAS.', serverEnabled: 'Enable Movviz player on this instance', serverEnabledHint: 'Enables the unified engine for profiles that did not explicitly opt out.', bufferTtl: 'Playback reserve/cache', bufferTtlHint: 'Retention used by playback and resume mechanisms.', debugToggle: 'Player diagnostics', debugToggleHint: 'Shows codec decisions, copy/transcode mode, buffer and useful playback errors.'
  },
  it: {
    tab: 'Lettore', tabHint: 'Riproduzione diretta, transcodifica Movviz, audio, buffer e diagnostica.', unifiedTitle: 'Lettore Movviz', unifiedHint: 'Un solo motore sceglie automaticamente l’operazione minima necessaria per riprodurre il contenuto.', useMovviz: 'Usa il lettore Movviz', useMovvizHint: 'Riproduzione diretta quando possibile, altrimenti remux o transcodifica Movviz secondo le capacità reali del dispositivo.', autoEngine: 'Motore automatico unificato', autoEngineHint: 'Nessuna cascata MSE/HLS/Plex: il planner sceglie Direct, copia video + adattamento audio o transcodifica video solo se necessaria.', serverTitle: 'Motore multimediale del server', serverHint: 'Impostazioni comuni per Windows, Linux x64 e Linux ARM64/NAS.', serverEnabled: 'Abilita il lettore Movviz su questa istanza', serverEnabledHint: 'Abilita il motore unificato per i profili che non lo hanno disattivato.', bufferTtl: 'Riserva/cache di riproduzione', bufferTtlHint: 'Durata di conservazione usata dai meccanismi di riproduzione e ripresa.', debugToggle: 'Diagnostica lettore', debugToggleHint: 'Mostra decisioni codec, copia/transcodifica, buffer ed errori utili.'
  },
  nl: {
    tab: 'Speler', tabHint: 'Direct afspelen, Movviz-transcoding, audio, buffer en diagnose.', unifiedTitle: 'Movviz-speler', unifiedHint: 'Eén engine kiest automatisch de kleinste bewerking die nodig is om media af te spelen.', useMovviz: 'Movviz-speler gebruiken', useMovvizHint: 'Direct afspelen waar mogelijk, anders remux of Movviz-transcoding volgens de echte mogelijkheden van dit apparaat.', autoEngine: 'Geünificeerde automatische engine', autoEngineHint: 'Geen MSE/HLS/Plex-cascade: de planner kiest Direct, videokopie + audio-aanpassing, of videotranscoding alleen wanneer nodig.', serverTitle: 'Media-engine van de server', serverHint: 'Gedeelde instellingen voor Windows, Linux x64 en Linux ARM64/NAS.', serverEnabled: 'Movviz-speler op deze instantie inschakelen', serverEnabledHint: 'Schakelt de geünificeerde engine in voor profielen die zich niet expliciet hebben afgemeld.', bufferTtl: 'Afspeelreserve/cache', bufferTtlHint: 'Bewaarperiode gebruikt door afspeel- en hervattingsmechanismen.', debugToggle: 'Spelerdiagnose', debugToggleHint: 'Toont codec-keuzes, kopie/transcoding, buffer en nuttige afspeelfouten.'
  },
  de: {
    tab: 'Player', tabHint: 'Direktwiedergabe, Movviz-Transcoding, Audio, Puffer und Diagnose.', unifiedTitle: 'Movviz Player', unifiedHint: 'Eine Engine wählt automatisch den kleinsten nötigen Verarbeitungsschritt für die Wiedergabe.', useMovviz: 'Movviz Player verwenden', useMovvizHint: 'Direktwiedergabe wenn möglich, sonst Remux oder Movviz-Transcoding nach den tatsächlichen Fähigkeiten dieses Geräts.', autoEngine: 'Einheitliche Automatik-Engine', autoEngineHint: 'Keine MSE/HLS/Plex-Kaskade: der Planner wählt Direct, Videokopie + Audioanpassung oder Videotranscoding nur wenn nötig.', serverTitle: 'Medien-Engine des Servers', serverHint: 'Gemeinsame Einstellungen für Windows, Linux x64 und Linux ARM64/NAS.', serverEnabled: 'Movviz Player auf dieser Instanz aktivieren', serverEnabledHint: 'Aktiviert die einheitliche Engine für Profile, die sie nicht ausdrücklich deaktiviert haben.', bufferTtl: 'Wiedergabereserve/Cache', bufferTtlHint: 'Aufbewahrungsdauer für Wiedergabe- und Fortsetzungsmechanismen.', debugToggle: 'Player-Diagnose', debugToggleHint: 'Zeigt Codec-Entscheidungen, Kopie/Transcoding, Puffer und hilfreiche Wiedergabefehler.'
  }
};
for (const [locale, v] of Object.entries(localeStrings)) {
  const p = `src/i18n/locales/${locale}.ts`;
  let s = read(p);
  const tabNeedle = /(^\s*tabPlex:\s*[^\n]+\n)/m;
  must(tabNeedle.test(s), `${locale}: tabPlex anchor`);
  s = s.replace(tabNeedle, `$1    tabPlayer: ${JSON.stringify(v.tab)},\n`);
  const hintNeedle = /(^\s*tabPlexHint:\s*[^\n]+\n)/m;
  must(hintNeedle.test(s), `${locale}: tabPlexHint anchor`);
  s = s.replace(hintNeedle, `$1    tabPlayerHint: ${JSON.stringify(v.tabHint)},\n`);
  const playerNeedle = /(^\s*playbackSectionTitle:\s*[^\n]+\n)/m;
  must(playerNeedle.test(s), `${locale}: playbackSectionTitle anchor`);
  const extra = [
    ['unifiedTitle', v.unifiedTitle], ['unifiedHint', v.unifiedHint], ['useMovviz', v.useMovviz], ['useMovvizHint', v.useMovvizHint],
    ['autoEngine', v.autoEngine], ['autoEngineHint', v.autoEngineHint], ['serverTitle', v.serverTitle], ['serverHint', v.serverHint],
    ['serverEnabled', v.serverEnabled], ['serverEnabledHint', v.serverEnabledHint], ['bufferTtl', v.bufferTtl], ['bufferTtlHint', v.bufferTtlHint],
    ['debugToggle', v.debugToggle], ['debugToggleHint', v.debugToggleHint],
  ].map(([k,val]) => `    ${k}: ${JSON.stringify(val)},`).join('\n') + '\n';
  s = s.replace(playerNeedle, `$1${extra}`);
  // Remove stale UI text telling users to re-enable Plex HLS.
  s = s.replace(/(^\s*betaHlsDisabled:\s*)[^\n]+/m, `$1${JSON.stringify(v.autoEngineHint)},`);
  write(p, s);
}

// ---------------------------------------------------------------------------
// 8) Docker/ARM build proves FFmpeg+ffprobe exist in the actual runtime image.
// ---------------------------------------------------------------------------
{
  const p = 'packaging/docker/Dockerfile';
  let s = read(p);
  const anchor = 'RUN apk add --no-cache su-exec aria2 rtorrent ffmpeg fontconfig ttf-dejavu\n';
  if (!s.includes('RUN ffmpeg -version')) s = replaceOnce(s, anchor, anchor + 'RUN ffmpeg -version >/dev/null && ffprobe -version >/dev/null\n', 'docker media runtime smoke');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 9) Tests updated to the post-Plex planner contract + selected-track invariant.
// ---------------------------------------------------------------------------
{
  const p = 'scripts/playback-session-manager.test.ts';
  let s = read(p);
  s = s.replace(/\ntest\("legacy PLEX_FALLBACK mode[\s\S]*?\n\}\);\n/, '\n');
  s = s.replace(/\ntest\("a session created in a normal mode starts with plexFallbackUsed false"[\s\S]*?\n\}\);\n/, '\n');
  s = s.replace('test("recordFallbackAttempt updates mode/count without ever activating Plex Transcoder state", () => {', 'test("recordFallbackAttempt updates mode/count inside the Movviz engine", () => {');
  s = s.replace('  assert.equal(step1!.plexFallbackUsed, false);\n', '');
  s = s.replace('  assert.equal(step2!.plexFallbackUsed, false);\n', '');
  write(p, s);
}

{
  const p = 'scripts/playback-source-session.test.ts';
  let s = read(p);
  s = s.replace('  assert.equal(s.plexFallbackUsed, false);\n', '');
  write(p, s);
}

{
  const p = 'scripts/decide-playback.test.ts';
  let s = read(p);
  s = s.replace('  assert.notEqual(plan.mode, "PLEX_FALLBACK");\n', '');
  s = s.replace('  assert.ok(!plan.reasons.includes("PLEX_FALLBACK_REQUESTED"));', '  assert.ok(plan.reasons.includes("MOVVIZ_TRANSCODER_UNAVAILABLE"));');
  if (!s.includes('selected French AAC track ignores unselected English DTS')) {
    s += `\n\ntest("selected French AAC track ignores unselected English DTS and never transcodes video/audio", () => {\n  const plan = decidePlayback({\n    media: media({\n      container: "matroska,webm",\n      video: { index: 0, codec: "hevc", width: 1920, height: 1080 },\n      audioTracks: [\n        { index: 1, codec: "dts", language: "eng", channels: 6, default: true, forced: false },\n        { index: 2, codec: "aac", language: "fra", channels: 2, default: false, forced: false },\n      ],\n    }),\n    client: client({ containers: ["mp4"], videoCapabilities: [{ codec: "hevc" }], audioCapabilities: [{ codec: "aac", decode: true, maxChannels: 2 }] }),\n    server: FFMPEG_OK,\n    selectedAudio: 2,\n  });\n  assert.equal(plan.mode, "REMUX");\n  assert.equal(plan.videoAction, "COPY");\n  assert.equal(plan.audioAction, "COPY");\n  assert.ok(plan.reasons.includes("AUDIO_TRACK_SELECTION_REQUIRED"));\n});\n\ntest("selected English DTS transcodes audio only while video remains bit-exact copy", () => {\n  const plan = decidePlayback({\n    media: media({\n      video: { index: 0, codec: "hevc", width: 1920, height: 1080 },\n      audioTracks: [\n        { index: 1, codec: "aac", language: "fra", channels: 2, default: true, forced: false },\n        { index: 2, codec: "dts", language: "eng", channels: 6, default: false, forced: false },\n      ],\n    }),\n    client: client({ videoCapabilities: [{ codec: "hevc" }], audioCapabilities: [{ codec: "aac", decode: true, maxChannels: 2 }] }),\n    server: FFMPEG_OK,\n    selectedAudio: 2,\n  });\n  assert.equal(plan.mode, "DIRECT_STREAM");\n  assert.equal(plan.videoAction, "COPY");\n  assert.equal(plan.audioAction, "TRANSCODE");\n});\n`;
  }
  write(p, s);
}

// ---------------------------------------------------------------------------
// 10) Version metadata v1.24.04.
// ---------------------------------------------------------------------------
{
  const old = '1.24.03', neu = '1.24.04';
  const pkgPath = 'package.json'; const pkg = JSON.parse(read(pkgPath)); must(pkg.version === old, `package version=${pkg.version}`); pkg.version = neu; write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  const lockPath = 'package-lock.json'; const lock = JSON.parse(read(lockPath)); must(lock.version === old && lock.packages?.['']?.version === old, 'lock version mismatch'); lock.version = neu; lock.packages[''].version = neu; write(lockPath, JSON.stringify(lock, null, 2) + '\n');
  for (const p of ['android-tv/app/build.gradle.kts', 'android-mobile/app/build.gradle.kts']) {
    let s = read(p); s = s.replace(/(versionCode\s*=.*\?:\s*)12403\b/, '$112404').replace(/(versionName\s*=.*\?:\s*)"1\.24\.03"/, '$1"1.24.04"'); must(s.includes('12404') && s.includes('"1.24.04"'), `${p} version bump`); write(p, s);
  }
  let readme = read('README.md'); readme = readme.replace('Movviz-1.24.03', 'Movviz-1.24.04'); write('README.md', readme);
  let ch = read('CHANGELOG.md');
  const entry = `# Changelog\n\n## v1.24.04 — August 2026\n\n### Lecteur Movviz unifié\n\nLe lecteur automatique passe par un seul planner Movviz pour les fichiers locaux et les sources Plex brutes : lecture directe quand le client sait réellement décoder, remux lorsque seule la piste/le conteneur doit changer, transcodage audio sans toucher à la vidéo quand seule l’audio est incompatible, et transcodage vidéo uniquement lorsque nécessaire. La piste audio réellement sélectionnée est décidée avant le codec : une piste DTS non sélectionnée ne peut plus déclencher un transcodage alors que la piste écoutée est AAC. HDR→SDR reste interdit sous 3× au benchmark. Les transcodages vidéo logiciels s’adaptent au benchmark et sont limités à 1,5× de lecture anticipée pour garder du buffer sans faire travailler inutilement le serveur.\n\n### Windows, Linux et ARM64\n\nFFmpeg/ffprobe utilisent désormais un runtime média commun. L’installeur Windows embarque ses propres binaires et le service pointe explicitement dessus ; les images Docker amd64/arm64 vérifient FFmpeg et ffprobe pendant leur build. Le benchmark utilise la même résolution de runtime que le lecteur.\n\n### Réglages → Lecteur\n\nLes options de lecture quittent Réglages → Plex. Un onglet Lecteur dédié regroupe activation par profil, langue audio, moteur automatique, réserve/cache, diagnostic et benchmark. Les anciens choix manuels MSE/FFmpeg/HLS/Bêta sont migrés vers Auto ; Plex conserve uniquement connexion, synchronisation et profils.\n\n`;
  must(ch.startsWith('# Changelog\n'), 'changelog header'); ch = entry + ch.slice('# Changelog\n\n'.length); write('CHANGELOG.md', ch);
}

// ---------------------------------------------------------------------------
// 11) Remove every migration/temp artifact from earlier iterations AND this
//     one-shot finalizer/workflow itself. Final release contains none of them.
// ---------------------------------------------------------------------------
for (const p of [
  '.github/workflows/apply-playback-v3.yml',
  'scripts/refactor-playback-v3.mjs', 'scripts/refactor-playback-v3-fixed.mjs',
  'scripts/DO_NOT_USE-playback-v3.tmp', 'scripts/README-playback-v3.tmp', 'scripts/a.tmp', 'scripts/b.tmp', 'scripts/c.tmp', 'scripts/d.tmp',
  'scripts/last-temp.tmp', 'scripts/placeholder-stop.tmp', 'scripts/playback-v3-cleanup-plan.txt', 'scripts/stop.tmp', 'scripts/temp-note-playback-v3.txt',
  'scripts/tmp-final.txt', 'scripts/tmp-playback-v3-final-marker',
  '.github/workflows/v12404-finalize-release.yml', 'scripts/v12404-finalize.mjs',
]) removeIfExists(p);

console.log('v1.24.04 playback finalization applied and scaffolding removed');

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolveLocalFilePath, resolveMoviePlayback, resolveEpisodePlayback } from "@/lib/playback/sourceResolver";
import { getOrProbeMediaDescriptor, getOrProbeRemoteMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";
import { resolvePlexPartUrl } from "@/lib/playback/plexSource";
import { detectServerCapabilities } from "@/lib/playback/engine/serverCapabilities.detect";
import { decidePlayback } from "@/lib/playback/engine/decidePlayback";
import { createSession } from "@/lib/playback/engine/sessionManager";
import { benchmarkRealtimeFactor } from "@/lib/playback/engine/serverBenchmark";
import type { ClientPlaybackProfile } from "@/lib/playback/engine/clientProfile";
import { findTrackForLocale } from "@/lib/library/detectLanguage";
import { isHdrDvToSdrEnabled } from "@/lib/settings/betaPlayer";
import { loadUserPrefs } from "@/lib/userPrefs/store";

export const dynamic = "force-dynamic";

/**
 * The client/server contract for the decidePlayback()-driven engine — the
 * one and only place a MediaDescriptor and a PlaybackPlan get produced for a
 * real playback request. Called live from VideoPlayer.tsx's
 * tryStartUnifiedEngine() for both movies and (now) episodes, whenever the
 * playback engine setting is "auto"/"stable"/"beta" and the title is a real
 * local file or original Plex raw part. A file with no
 * MediaDescriptor cached yet gets probed right here on-demand
 * (getOrProbeMediaDescriptor already does this transparently — "never probe
 * at every playback" only means "don't re-probe an unchanged file", not
 * "never probe on a cache miss").
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const mediaId = typeof b.mediaId === "string" ? b.mediaId.trim() : "";
  const requestedRatingKey = typeof b.ratingKey === "string" ? b.ratingKey.trim() : "";
  const clientProfile = b.clientProfile as ClientPlaybackProfile | undefined;
  if (!mediaId || !clientProfile || typeof clientProfile !== "object") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (
    !clientProfile.clientType ||
    !clientProfile.deviceId ||
    !Array.isArray(clientProfile.videoCapabilities) ||
    !Array.isArray(clientProfile.audioCapabilities) ||
    !Array.isArray(clientProfile.subtitleCapabilities) ||
    !Array.isArray(clientProfile.containers)
  ) {
    return NextResponse.json({ error: "invalid_client_profile" }, { status: 400 });
  }

  // Source resolution happens ONCE, before planning. Local bytes are always
  // preferred. If the file is not locally resolvable and a real Plex
  // ratingKey exists, Plex contributes only its original /library/parts URL.
  // No /transcode endpoint is used anywhere in this engine.
  const resolution = resolveLocalFilePath(mediaId);
  // Fichier local illisible depuis ce conteneur : la clé Plex du titre sert de
  // repli même si le client ne l'a pas transmise.
  let ratingKey = requestedRatingKey;
  if (!resolution.ok && !ratingKey) {
    const episodeRef = /^(.+):s(\d+)e(\d+)$/.exec(mediaId);
    const fallback = episodeRef ? resolveEpisodePlayback(episodeRef[1], Number(episodeRef[2]), Number(episodeRef[3])) : resolveMoviePlayback(mediaId);
    if (fallback.ok && fallback.value.plexRatingKey) ratingKey = fallback.value.plexRatingKey;
  }
  let media;
  let source;
  let directUrl: string;
  if (resolution.ok) {
    media = await getOrProbeMediaDescriptor(mediaId, resolution.path);
    if (!media) return NextResponse.json({ error: "file_missing" }, { status: 404 });
    source = { type: "local" as const, uri: resolution.path, localPath: resolution.path, sourceKey: "local" };
    const episodeMatch = /^(.+):s(\d+)e(\d+)$/.exec(mediaId);
    directUrl = episodeMatch
      ? `/api/stream/local/episode/${encodeURIComponent(episodeMatch[1])}/${episodeMatch[2]}/${episodeMatch[3]}`
      : `/api/stream/local/${encodeURIComponent(mediaId)}`;
  } else if (ratingKey) {
    const part = await resolvePlexPartUrl(ratingKey, user.id);
    if (!part) return NextResponse.json({ error: "plex_raw_source_unavailable" }, { status: 404 });
    media = await getOrProbeRemoteMediaDescriptor(mediaId, part.sourceUrl, part.headers);
    if (!media) return NextResponse.json({ error: "plex_raw_probe_failed" }, { status: 502 });
    source = {
      type: "plex_raw" as const,
      uri: part.sourceUrl,
      headers: part.headers,
      ratingKey,
      sourceKey: `plex:${ratingKey}`,
    };
    directUrl = `/api/stream/${encodeURIComponent(ratingKey)}`;
  } else {
    return NextResponse.json(
      { error: resolution.code === "not_found" ? "media_not_found" : "media_unavailable" },
      { status: 404 }
    );
  }

  const server = await detectServerCapabilities();
  let audioTrack = Number.isInteger(b.audioTrack) ? (b.audioTrack as number) : undefined;
  const requestedAudioLanguage = typeof b.audioLanguage === "string" ? b.audioLanguage.trim().toLowerCase() : "";
  if (audioTrack === undefined && requestedAudioLanguage) {
    audioTrack = findTrackForLocale(media.audioTracks, requestedAudioLanguage)?.index;
  }
  const subtitleTrackRaw = b.subtitleTrack;
  let subtitleTrack = subtitleTrackRaw === null ? null : Number.isInteger(subtitleTrackRaw) ? (subtitleTrackRaw as number) : undefined;
  // Sous-titres automatiques du profil (réglage de compte, désactivé par
  // défaut) : uniquement quand le client n'a exprimé AUCUN choix (champ absent)
  // — un null explicite reste « sans sous-titres ». Aucune dépendance à Plex :
  // tout vient des pistes ffprobe du fichier.
  let autoSubtitle = false;
  if (subtitleTrackRaw === undefined) {
    const prefs = loadUserPrefs(user.id);
    if (prefs.autoSubtitles === true) {
      // Langue du profil = langue d'interface choisie (drapeaux), distincte de
      // la langue audio préférée : un profil français qui préfère l'audio
      // anglais obtient justement des sous-titres français.
      const clientProfileLanguage = typeof b.profileLanguage === "string" ? b.profileLanguage.trim().toLowerCase() : "";
      const profileLanguage = prefs.locale ?? (clientProfileLanguage || requestedAudioLanguage);
      const playedAudio = media.audioTracks.find((t) => t.index === audioTrack) ?? media.audioTracks.find((t) => t.default) ?? media.audioTracks[0];
      if (profileLanguage && playedAudio && !findTrackForLocale([playedAudio], profileLanguage)) {
        const candidates = media.subtitleTracks.filter((t) => findTrackForLocale([t], profileLanguage));
        const chosen = candidates.find((t) => !t.forced) ?? candidates[0];
        if (chosen) { subtitleTrack = chosen.index; autoSubtitle = true; }
      }
    }
  }
  const quality = typeof b.quality === "string" ? (b.quality as "original" | "auto" | "4k" | "1440p" | "1080p" | "720p") : undefined;

  // Instance-wide product rule from Settings > Player. OFF is a hard veto:
  // HDR10/HDR10+/HLG/Dolby Vision are never tonemapped to SDR, regardless of
  // benchmark headroom. ON still does NOT force tonemapping: decidePlayback()
  // keeps the existing >= 3× real-time benchmark requirement.
  const hdrDvToSdrEnabled = isHdrDvToSdrEnabled();
  const measuredToneMapFactor = benchmarkRealtimeFactor("software_720p_tonemap");

  const plan = decidePlayback({
    media, client: clientProfile, server, selectedAudio: audioTrack, selectedSubtitle: subtitleTrack, quality,
    performance: {
      toneMapRealtimeFactor: hdrDvToSdrEnabled ? measuredToneMapFactor : 0,
      software1080pRealtimeFactor: benchmarkRealtimeFactor("software_1080p"),
    },
  });

  const session = createSession({
    userId: user.id,
    deviceId: clientProfile.deviceId,
    clientType: clientProfile.clientType,
    mediaId,
    source,
    mode: plan.mode,
    selectedAudio: audioTrack ?? null,
    selectedSubtitle: subtitleTrack ?? null,
    videoAction: plan.videoAction,
    audioAction: plan.audioAction,
    subtitleAction: plan.subtitleAction,
    plan,
  });

  // DIRECT_PLAY uses the raw-byte route for the already-selected source.
  // REMUX / DIRECT_STREAM / TRANSCODE all use the same Movviz executor.
  const streamUrl = plan.mode === "DIRECT_PLAY"
    ? directUrl
    : `/api/playback/session/${session.sessionId}/stream`;

  return NextResponse.json({
    sessionId: session.sessionId,
    media,
    plan,
    tracks: { audio: media.audioTracks, subtitle: media.subtitleTracks },
    selection: { subtitle: subtitleTrack ?? null, subtitleAuto: autoSubtitle },
    source: { type: source.type },
    markers: {},
    resume: {},
    stream: {
      url: streamUrl,
      protocol: (plan.protocol ?? "PROGRESSIVE").toLowerCase(),
    },
  });
}

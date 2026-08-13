import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { getStreamCacheTtl } from "@/lib/settings/betaPlayer";
import { registerSession } from "@/lib/player/transcodeSessions";
import { logTranscode } from "@/lib/player/transcodeLogs";
import {
  PLEX_UNIVERSAL_BASE,
  plexWebHeaders,
  rewriteM3u8,
} from "@/lib/player/plexStream";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ratingKey: string }> };

const DEFAULT_MAX_BITRATE = 8000;
const TRANSCODE_CACHE_TTL = 5; // master playlists must stay short-lived

// --- Sonde TS (fire-and-forget) ---
// Lit les stream types du premier segment TS produit par Plex : c'est la
// vérité du flux réellement servi au navigateur, sans dépendre du dashboard
// Plex (les sessions Movviz n'y apparaissent pas) ni de l'attribut CODECS du
// maître (omis). 0x24 = HEVC copié en bitstream, 0x1b = H.264 ré-encodé (le
// cas « copy ignoré »), 0x0f = AAC, 0x81 = AC3 copié, 0x87 = E-AC3...
const TS_STREAM_TYPE_NAMES: Record<number, string> = {
  0x01: "mpeg1", 0x02: "mpeg2", 0x03: "mp2", 0x04: "mp2", 0x06: "priv",
  0x0f: "aac", 0x15: "aac-latm", 0x1b: "h264", 0x24: "hevc", 0x27: "av1",
  0x81: "ac3", 0x82: "dts", 0x86: "dts-hd", 0x87: "eac3", 0x8a: "dts-hd",
};

function parseTsStreamTypes(buf: Uint8Array): { video?: number; audio?: number } {
  let pmtPid: number | null = null;
  const types: number[] = [];
  for (let i = 0; i + 187 < buf.length; i += 188) {
    if (buf[i] !== 0x47) {
      const idx = buf.indexOf(0x47, i + 1);
      if (idx === -1) break;
      i = idx - 188;
      continue;
    }
    const pid = ((buf[i + 1] & 0x1f) << 8) | buf[i + 2];
    if (pid === 0 && pmtPid === null) {
      // PAT : pointer_field puis section 0x00 ; boucle program_number + PMT PID
      const secStart = i + 4 + buf[i + 3];
      if (buf[secStart] !== 0x00) continue;
      const pnum = (buf[secStart + 8] << 8) | buf[secStart + 9];
      if (pnum !== 0) pmtPid = ((buf[secStart + 10] & 0x1f) << 8) | buf[secStart + 11];
    } else if (pmtPid !== null && pid === pmtPid) {
      // PMT : section 0x02 ; boucle ES = stream_type + elementary_PID + info_length
      const secStart = i + 4 + buf[i + 3];
      if (buf[secStart] !== 0x02) continue;
      const secLen = ((buf[secStart + 1] & 0x0f) << 8) | buf[secStart + 2];
      const progInfoLen = ((buf[secStart + 10] & 0x0f) << 8) | buf[secStart + 11];
      let p = secStart + 12 + progInfoLen;
      const end = Math.min(secStart + 3 + secLen, buf.length - 4);
      while (p + 5 <= end) {
        types.push(buf[p]);
        const esInfoLen = ((buf[p + 3] & 0x0f) << 8) | buf[p + 4];
        p += 5 + esInfoLen;
      }
      break;
    }
  }
  const video = types.find((t) => t === 0x1b || t === 0x24 || t === 0x27);
  const audio = types.find((t) => t === 0x0f || t === 0x03 || t === 0x04 || t === 0x81 || t === 0x82 || t === 0x86 || t === 0x87 || t === 0x8a);
  return { video, audio };
}

async function sniffFirstSegment(
  base: string,
  headers: Record<string, string>,
  masterRaw: string,
  ratingKey: string,
  sourceVideoCodec: string
): Promise<void> {
  const m = masterRaw.match(/session\/([^/]+)\/base\/index\.m3u8/);
  if (!m) return;
  const sessPath = `/video/:/transcode/universal/session/${m[1]}/base/`;
  // Le job peut mettre 1-3 s à produire le premier segment (warm-up transcode)
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const plRes = await fetch(`${base}${sessPath}index.m3u8`, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!plRes.ok) return;
      const pl = await plRes.text();
      const segLine = pl.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith("#"));
      if (!segLine) return;
      const segRes = await fetch(`${base}${sessPath}${segLine}`, {
        headers: { ...headers, range: "bytes=0-524287" },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (segRes.status === 404 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      if (!segRes.ok) return;
      const buf = new Uint8Array(await segRes.arrayBuffer());
      const { video, audio } = parseTsStreamTypes(buf);
      if (video === undefined && audio === undefined) return;
      const vName = video !== undefined ? (TS_STREAM_TYPE_NAMES[video] ?? `0x${video.toString(16)}`) : "?";
      const aName = audio !== undefined ? (TS_STREAM_TYPE_NAMES[audio] ?? `0x${audio.toString(16)}`) : "?";
      const reencoded = video === 0x1b && /hevc|h265|hev1|hvc1|av1/i.test(sourceVideoCodec);
      logTranscode(
        ratingKey,
        "plex-segments",
        `TS réel: vidéo=${vName} (0x${(video ?? 0).toString(16)}) audio=${aName} (0x${(audio ?? 0).toString(16)})${reencoded ? " — ⚠ VIDÉO RÉ-ENCODÉE malgré tv=0" : video === 0x24 && /hevc/i.test(sourceVideoCodec) ? " — ✓ HEVC copié en bitstream" : ""}`,
        reencoded ? "warn" : "ok"
      );
      if (reencoded) {
        console.error(`[transcode] ${ratingKey} ⚠ LE SEGMENT TS CONTIENT H.264 : vidéo ré-encodée malgré videoCodec=copy`);
      } else if (video === 0x24) {
        console.log(`[transcode] ${ratingKey} ✓ segments TS en HEVC : copy bitstream honoré`);
      }
      return;
    } catch {
      return;
    }
  }
}

function corsOrigin(req: NextRequest): string {
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    } catch { /* fallthrough */ }
  }
  return req.headers.get("origin") || "null";
}

function resolveClientMaxWidth(req: NextRequest): number {
  const qWidth = Number(req.nextUrl.searchParams.get("maxWidth"));
  if (qWidth > 0 && Number.isFinite(qWidth)) return qWidth;
  const hint = req.headers.get("x-movviz-client-width");
  if (hint) {
    const w = Number(hint);
    if (w > 0 && Number.isFinite(w)) return w;
  }
  return 1920;
}

/**
 * Plex metadata reports videoResolution as a STRING that is not always
 * numeric ("4k", "8k", "uhd") — Number("4k") = NaN, which silently reset the
 * video bitrate cap to the 1080p default (8000) for 4K sources that DO
 * transcode. Normalize the known labels before falling back to Media.height.
 */
function parseSourceHeight(media: Record<string, unknown>): number {
  const raw = String(media?.videoResolution ?? "").toLowerCase();
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === "8k") return 4320;
  if (raw === "4k" || raw === "uhd" || raw === "2160") return 2160;
  const h = Number(media?.height ?? 0);
  return Number.isFinite(h) && h > 0 ? h : 0;
}

function selectBitrate(sourceHeight: number, clientWidth: number): number {
  let cap = DEFAULT_MAX_BITRATE;
  if (sourceHeight >= 2000) cap = 15000;
  else if (sourceHeight >= 1440) cap = 10000;
  else if (sourceHeight >= 1000) cap = 8000;
  else if (sourceHeight >= 700) cap = 4000;
  else cap = 2000;

  if (clientWidth < 1920) {
    if (clientWidth <= 720) cap = Math.min(cap, 1500);
    else if (clientWidth <= 1080) cap = Math.min(cap, 3000);
    else if (clientWidth <= 1440) cap = Math.min(cap, 6000);
  }

  return cap;
}

export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;

  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) {
    return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  }

  const base = safePlexUrl(`${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`);
  if (!base) return NextResponse.json({ error: "invalid_plex_url" }, { status: 500 });

  if (!registerSession(user.id, ratingKey)) {
    logTranscode(ratingKey, "session", "Too many concurrent transcode sessions", 429);
    return NextResponse.json({ error: "too_many_transcode_sessions" }, { status: 429 });
  }

  const token = cfg.adminToken;
  const clientId = `movviz-${user.id}`;
  const sessionId = `movviz-${user.id}-${ratingKey}`;
  // Plex Web profile impersonation (see plexStream.ts): without it, MDE
  // matches an unknown "Movviz" client profile that lacks HEVC support and
  // silently re-encodes HEVC sources to H.264 even when videoCodec=copy is
  // requested — the exact "audio-only transcode that still lags" case.
  const headers = plexWebHeaders(token, clientId, sessionId);

  const metadataUrl = `${base}/library/metadata/${ratingKey}`;
  const metaRes = await fetch(metadataUrl, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!metaRes.ok) {
    const body = await metaRes.text().catch(() => "");
    logTranscode(ratingKey, "meta-fetch", `HTTP ${metaRes.status}: ${body.slice(0, 200)}`, metaRes.status);
    return NextResponse.json({ error: "metadata_fetch_failed" }, { status: 502 });
  }

  const data = await metaRes.json();
  const metadata = data?.MediaContainer?.Metadata?.[0];
  if (!metadata) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const media = metadata?.Media?.[0];
  const height = parseSourceHeight(media ?? {});
  const sp = req.nextUrl.searchParams;
  const audioStreamID = sp.get("audioStreamID");
  const subtitleStreamID = sp.get("subtitleStreamID");
  let videoCodec = (media?.videoCodec as string)?.toLowerCase() ?? "";
  let audioCodec = (media?.audioCodec as string)?.toLowerCase() ?? "";
  // The default audioCodec is the FIRST track's codec — but audioStreamID may
  // target a different track (e.g. DTS default + AC3 second track, the common
  // Remux case). The copy decision must use the codec of the track that will
  // actually play, otherwise Plex transcodes it needlessly.
  if (audioStreamID) {
    const streams: Array<{ id?: number; streamType?: number; codec?: string }> =
      media?.Part?.[0]?.Stream ?? [];
    const target = streams.find(
      (s) => s.streamType === 2 && String(s.id) === String(audioStreamID)
    );
    if (target?.codec) audioCodec = target.codec.toLowerCase();
  }
  logTranscode(ratingKey, "meta", `container=${media?.container ?? "?"} video=${videoCodec} audio=${audioCodec}${audioStreamID ? ` (piste ${audioStreamID})` : ""} res=${height}p`, "ok");

  // Smart transcode: only re-encode what the browser can't play natively.
  // tv=0 → bitstream-copy video (direct stream), tv=1 (default) → re-encode to h264.
  // ta=0 → bitstream-copy audio (direct stream), ta=1 (default) → re-encode to aac.
  // "copy" is accepted by Plex universal API as a passthrough hint.
  // Copy whitelist: Plex silently transcodes anything outside it (opus, flac,
  // vorbis, truehd...) — and browsers/hls.js can't handle E-AC3/DTS/TrueHD in
  // TS anyway, so we never request copy for them. hls.js only transmuxes
  // AAC / MP3 / AC-3 from MPEG-TS (E-AC3 = parsing error → silent video).
  const tv = sp.get("tv"); // "0" = copy, missing/"1" = transcode
  const ta = sp.get("ta");
  const COPY_SAFE_AUDIO = ["aac", "mp4a", "ac3", "ac-3", "mp3"];
  const COPY_SAFE_VIDEO = ["h264", "h.264", "hevc", "h265", "av1", "vp9"];
  // "eac3" contains "ac3" — exclude it explicitly, hls.js cannot demux E-AC3 from TS
  const copyAudioSafe =
    !audioCodec.includes("eac3") &&
    audioCodec !== "ec-3" &&
    COPY_SAFE_AUDIO.some((c) => audioCodec.includes(c));
  const copyVideoSafe = COPY_SAFE_VIDEO.some((c) => videoCodec.includes(c));
  const srcIsHevc = /hevc|h265|hev1|hvc1/.test(videoCodec);
  const srcIsAv1 = /av1|av01/.test(videoCodec);
  const transcodeVideoCodec = tv === "0" && copyVideoSafe ? "copy" : "h264";
  const transcodeAudioCodec = ta === "0" && copyAudioSafe ? "copy" : "aac";

  const clientWidth = resolveClientMaxWidth(req);
  const qMaxBitrate = Number(sp.get("maxVideoBitrate"));
  const maxVideoBitrate = qMaxBitrate > 0 && Number.isFinite(qMaxBitrate)
    ? qMaxBitrate
    : selectBitrate(height, clientWidth);

  // directPlay=0 forces HLS packaging (required for hls.js).
  // directStream=1 allows bitstream copy when codecs already match the target.
  const qs = new URLSearchParams({
    path: `/library/metadata/${ratingKey}`,
    mediaIndex: "0",
    partIndex: "0",
    protocol: "hls",
    videoCodec: transcodeVideoCodec,
    audioCodec: transcodeAudioCodec,
    fastSeek: "1",
    directPlay: "0",
    directStream: "1",
    subtitleSize: "100",
    session: sessionId,
    "X-Plex-Platform": "Chrome",
    "X-Plex-Client-Identifier": clientId,
    // MDE lit les X-Plex-* du QUERY STRING en plus des headers : une identité
    // « Movviz » ici écraserait le profil « Plex Web » des headers et le copy
    // HEVC serait re-refusé — les deux sources doivent raconter la même chose.
    "X-Plex-Product": "Plex Web",
    "X-Plex-Device": "Windows",
    "X-Plex-Version": "4.100.0",
    "X-Plex-Model": "Plex Web",
  });
  // Only set bitrate when video is actually being transcoded (not copied)
  if (transcodeVideoCodec !== "copy") {
    qs.set("maxVideoBitrate", String(maxVideoBitrate));
  }
  if (audioStreamID) qs.set("audioStreamID", audioStreamID);
  if (subtitleStreamID) qs.set("subtitleStreamID", subtitleStreamID);

  const transcodeUrl = `${base}${PLEX_UNIVERSAL_BASE}/start.m3u8?${qs.toString()}`;

  // VÉRITÉ DU MOTEUR DE DÉCISION : /decision répond AVANT le démarrage avec ce
  // que MDE compte réellement produire (copy vs ré-encodage). Le maître HLS
  // omet l'attribut CODECS sur les sessions direct-stream (réel ?) — c'est
  // donc la seule source fiable pour savoir si la vidéo sera copiée ou
  // ré-encodée malgré tv=0 (le cas « audio seul qui lag »).
  try {
    const decisionUrl = `${base}${PLEX_UNIVERSAL_BASE}/decision?${qs.toString()}`;
    const decRes = await fetch(decisionUrl, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!decRes.ok) {
      const decBody = await decRes.text().catch(() => "");
      logTranscode(ratingKey, "plex-decision", `HTTP ${decRes.status}: ${decBody.slice(0, 200)}`, decRes.status);
      console.error(`[transcode] ${ratingKey} /decision FAIL ${decRes.status}: ${decBody.slice(0, 200)}`);
    } else {
      const dec = await decRes.json().catch(() => null);
      const m = dec?.MediaContainer?.Media?.[0];
      if (!m) {
        // PMS répond parfois avec directPlayDecisionCode/generalDecisionCode au
        // lieu de Media[] — le corps contient transcodeDecisionText (la raison
        // exacte du transcode) : journaliser le corps ENTIER.
        const body = JSON.stringify(dec) ?? "null";
        const tt = dec?.MediaContainer?.transcodeDecisionText;
        logTranscode(
          ratingKey,
          "plex-decision",
          `réponse sans Media: ${typeof tt === "string" ? `transcodeDecisionText="${tt}" | ` : ""}${body}`,
          502
        );
      } else {
        const decision = String(m.Decision ?? "?");
        const decVideo = String(m.videoCodec ?? "?");
        const decAudio = String(m.audioCodec ?? "?");
        const planReencodesVideo = transcodeVideoCodec === "copy" && decision !== "copy" && !String(decVideo).includes("copy");
        logTranscode(
          ratingKey,
          "plex-decision",
          `Decision=${decision} v=${decVideo} a=${decAudio} container=${m.container ?? "?"}${planReencodesVideo ? " — ⚠ MDE IGNORE le copy vidéo" : ""}`,
          planReencodesVideo ? "warn" : "ok"
        );
        if (planReencodesVideo) {
          console.error(`[transcode] ${ratingKey} ⚠ MDE prévoit de RÉ-ENCODER la vidéo (${decVideo}) malgré tv=0 — profil « Plex Web » ignoré ou codec non copiable`);
        } else if (transcodeVideoCodec === "copy" && srcIsHevc && String(decVideo).includes("copy")) {
          console.log(`[transcode] ${ratingKey} ✓ MDE honore le copy HEVC (décision=${decision}) — vidéo copiée en bitstream`);
        }
      }
    }
  } catch (err) {
    // /decision est consultatif — ne bloque jamais le démarrage de session
    console.error(`[transcode] ${ratingKey} /decision error: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const brLog = transcodeVideoCodec !== "copy" ? ` br=${maxVideoBitrate}k` : "";
    console.log(`[transcode] ${ratingKey} → start.m3u8 tv=${tv} ta=${ta} v=${transcodeVideoCodec} a=${transcodeAudioCodec}${brLog}`);
    logTranscode(ratingKey, "plex-fetch", `tv=${tv} ta=${ta} codecs: v=${transcodeVideoCodec} a=${transcodeAudioCodec}${brLog}`, "ok");
    const m3u8Res = await fetch(transcodeUrl, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!m3u8Res.ok) {
      const body = await m3u8Res.text().catch(() => "");
      logTranscode(ratingKey, "plex-response", `HTTP ${m3u8Res.status}: ${body.slice(0, 200)}`, m3u8Res.status);
      console.error(`[transcode] ${ratingKey} FAIL ${m3u8Res.status}: ${body.slice(0, 300)}`);
      console.error(`[transcode] ${ratingKey} codecs → video:${videoCodec} audio:${audioCodec}`);
      return NextResponse.json({ error: "transcode_start_failed", status: m3u8Res.status }, { status: 502 });
    }

    const raw = await m3u8Res.text();
    if (!raw.includes("#EXTM3U")) {
      logTranscode(ratingKey, "m3u8", `invalid body: ${raw.slice(0, 120)}`, 502);
      console.error(`[transcode] ${ratingKey} not an m3u8: ${raw.slice(0, 200)}`);
      return NextResponse.json({ error: "transcode_invalid_playlist" }, { status: 502 });
    }

    // VÉRITÉ DE LA SESSION EN COURS : /status/sessions expose les décisions
    // RÉELLEMENT appliquées par le job (videoDecision/audioDecision = copy ou
    // transcode, codecs de sortie, vitesse du job). Le maître HLS n'a pas de
    // CODECS et /decision ne donne que le plan : ici c'est l'exécution.
    // Deux tentatives espacées de 400 ms — le job peut mettre un instant à
    // apparaître dans la liste des sessions. TOUJOURS journaliser un résultat :
    // session trouvée (avec ou sans TranscodeSession), introuvable (avec la
    // liste des sessions actives), échec HTTP ou erreur réseau.
    for (let attempt = 0; attempt < 2; attempt++) {
      let sessOutcome = "";
      try {
        const sessRes = await fetch(`${base}/status/sessions`, {
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!sessRes.ok) {
          sessOutcome = `HTTP ${sessRes.status}`;
          logTranscode(ratingKey, "plex-session", `probe HTTP ${sessRes.status}`, sessRes.status);
          break;
        }
        const sessJson = await sessRes.json().catch(() => null);
        const meta = sessJson?.MediaContainer?.Metadata ?? [];
        const mine = meta.find(
          (s: { Session?: { id?: string } }) => String(s?.Session?.id ?? "") === sessionId
        );
        if (!mine) {
          sessOutcome = `introuvable (${meta.length} active(s): ${meta
            .map((s: { Session?: { id?: string }; Player?: { state?: string } }) => `${String(s?.Session?.id ?? "?")}=${s?.Player?.state ?? "?"}`)
            .slice(0, 6)
            .join(", ")})`;
        } else {
          const td = mine.TranscodeSession;
          if (td) {
            const vDec = String(td.videoDecision ?? "?");
            const aDec = String(td.audioDecision ?? "?");
            logTranscode(
              ratingKey,
              "plex-session",
              `réel: v=${td.videoCodec ?? "?"} (${vDec}) a=${td.audioCodec ?? "?"} (${aDec}) src=${td.sourceVideoCodec ?? "?"}→${videoCodec} ${td.width ?? "?"}x${td.height ?? "?"} speed=${td.speed ?? "?"}${td.transcodeHwFullPipeline ? " hw=plein" : ""}`,
              vDec !== "copy" && transcodeVideoCodec === "copy" ? "warn" : "ok"
            );
            if (vDec !== "copy" && transcodeVideoCodec === "copy") {
              console.error(`[transcode] ${ratingKey} ⚠ LA SESSION RÉ-ENCODE LA VIDÉO (videoDecision=${vDec}) malgré tv=0`);
            }
            break;
          }
          sessOutcome = `trouvée SANS TranscodeSession (direct stream)`;
        }
      } catch (err) {
        sessOutcome = `erreur: ${err instanceof Error ? err.message : String(err)}`;
      }
      if (sessOutcome) {
        logTranscode(ratingKey, "plex-session", sessOutcome, 0);
        console.log(`[transcode] ${ratingKey} /status/sessions: ${sessOutcome}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    // Master playlist lives at .../universal/start.m3u8 — relative session/ URIs
    // resolve against .../universal/
    const masterPath = `${PLEX_UNIVERSAL_BASE}/start.m3u8`;
    const rewritten = rewriteM3u8(raw, masterPath);

    // VÉRITÉ DU TERRAIN : le maître contient les codecs EFFECTIVEMENT produits
    // par Plex (CODECS="...") — pas ceux qu'on a demandés. Quand on demande un
    // copy vidéo (tv=0) et que Plex ré-encode quand même (HEVC/AV1 10-bit/HDR
    // non copiables en HLS-TS, sous-titres PGS/ASS brûlés...), la vidéo est
    // transcodée EN SILENCE : c'est la cause n°1 des « audio seul » qui laguent.
    // On la détecte ici et on la crie dans les logs + en-tête de réponse.
    const streamInf = raw.match(/#EXT-X-STREAM-INF:[^\n]*/)?.[0] ?? "";
    const actualCodecs = streamInf.match(/CODECS="([^"]+)"/i)?.[1] ?? "";
    const actualVideo = (actualCodecs.split(",")[0] ?? "").trim().toLowerCase();
    const videoCopyRefused =
      transcodeVideoCodec === "copy" &&
      actualVideo !== "" &&
      ((srcIsHevc && !actualVideo.includes("hev")) ||
        (srcIsAv1 && !actualVideo.includes("av01")));
    if (videoCopyRefused) {
      const why = subtitleStreamID
        ? `sous-titres ${subtitleStreamID} (brûlés dans la vidéo)`
        : `codec source ${videoCodec} non copiable en HLS-TS`;
      console.error(`[transcode] ${ratingKey} ⚠ Plex a IGNORÉ videoCodec=copy (${videoCodec} → ${actualVideo}) : vidéo ré-encodée. Cause probable : ${why}`);
      logTranscode(ratingKey, "plex-copy-refused", `demandé copy → réel ${actualVideo} (${why})`, "warn");
    } else {
      logTranscode(ratingKey, "plex-codecs", `demandé v=${transcodeVideoCodec} a=${transcodeAudioCodec} → réel ${actualCodecs || "?"}`, "ok");
    }

    logTranscode(ratingKey, "m3u8", `ok — ${raw.split("\n").length} lines, rewritten`, "ok");
    console.log(`[transcode] ${ratingKey} master rewritten:\n${rewritten.slice(0, 300)}`);

    const cacheTtl = getStreamCacheTtl();
    // Master must not be cached long — session paths are per-playback
    const maxAge = Math.min(cacheTtl > 0 ? cacheTtl : TRANSCODE_CACHE_TTL, TRANSCODE_CACHE_TTL);

    // Sonde des segments TS réels (fire-and-forget — n'ajoute aucun délai au
    // démarrage de la lecture). Répond sans attendre la vérité du flux.
    void sniffFirstSegment(base, headers, raw, ratingKey, videoCodec).catch(() => undefined);

    return new NextResponse(rewritten, {
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": `private, max-age=${maxAge}`,
        "access-control-allow-origin": corsOrigin(req),
        "access-control-allow-credentials": "true",
        "x-movviz-plex-codecs": actualCodecs || "unknown",
      },
    });
  } catch (e) {
    console.error("[transcode] error", ratingKey, e);
    logTranscode(ratingKey, "error", e instanceof Error ? e.message : String(e), 500);
    return NextResponse.json({ error: "transcode_error" }, { status: 500 });
  }
}

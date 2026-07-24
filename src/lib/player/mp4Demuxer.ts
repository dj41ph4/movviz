import * as MP4Box from "mp4box";

export interface DemuxerTrack {
  id: number;
  codec: string;
  timescale: number;
  duration: number;
  nbSamples: number;
  video?: { width: number; height: number };
  audio?: { sampleRate: number; channelCount: number };
  /** Raw avcC/hvcC/av1C decoder config record (without box header) */
  description?: ArrayBuffer;
}

export interface DemuxerSample {
  data: ArrayBuffer;
  dts: number;
  cts: number;
  duration: number;
  isRap: boolean;
  trackId: number;
}

export type DemuxerEvent =
  | { type: "ready"; tracks: DemuxerTrack[]; isFragmented?: boolean }
  | { type: "samples"; samples: DemuxerSample[] }
  | { type: "error"; message: string }
  | { type: "done" };

export interface DemuxerCallbacks {
  onEvent: (evt: DemuxerEvent) => void;
  onProgress?: (loaded: number, total: number) => void;
}

const CHUNK_SIZE = 1024 * 1024;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Extract the raw avcC/hvcC/av1C decoder config record from a track
 * by serializing the codec configuration box and stripping the box header.
 */
function extractCodecDescription(file: MP4Box.ISOFile, trackId: number): ArrayBuffer | undefined {
  try {
    const trak = file.getTrackById(trackId);
    if (!trak) return undefined;
    const stsd = trak.mdia?.minf?.stbl?.stsd;
    if (!stsd?.entries?.length) return undefined;
    const entry = stsd.entries[0] as unknown as MP4Box.VisualSampleEntry;
    // VisualSampleEntry has avcC/hvcC/av1C properties
    const codecBox: MP4Box.Box | undefined = (entry as any).avcC || (entry as any).hvcC || (entry as any).av1C;
    if (!codecBox || typeof (codecBox as any).write !== "function") return undefined;

    // Serialize the box to raw bytes using DataStream
    const stream = new MP4Box.DataStream(codecBox.size || 256, 0, MP4Box.Endianness.BIG_ENDIAN);
    (codecBox as any).write(stream);
    const pos = stream.getPosition();
    if (pos <= 0) return undefined;

    // Skip box header (8 bytes for avcC/hvcC which are not FullBox)
    const hdrSize = (codecBox as any).hdr_size || 8;
    if (pos <= hdrSize) return undefined;

    // Copy the decoder config record (content after box header)
    const raw = new Uint8Array(stream.buffer, 0, pos);
    return raw.slice(hdrSize).buffer as ArrayBuffer;
  } catch {
    return undefined;
  }
}

export async function fetchAndDemux(
  url: string,
  callbacks: DemuxerCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const file = MP4Box.createFile();
  const videoTrackIds: number[] = [];
  const audioTrackIds: number[] = [];
  let stopped = false;

  const cleanup = () => {
    try { file.stop(); file.flush(); } catch { /* ignore */ }
  };

  if (signal) {
    signal.addEventListener("abort", () => { stopped = true; cleanup(); });
  }

  file.onError = (msg: string) => {
    if (!stopped) callbacks.onEvent({ type: "error", message: msg });
  };

  file.onReady = (info: MP4Box.Movie) => {
    if (stopped) return;
    const tracks: DemuxerTrack[] = [];

    for (const t of info.tracks) {
      const track: DemuxerTrack = {
        id: t.id,
        codec: t.codec,
        timescale: t.timescale,
        duration: t.duration,
        nbSamples: t.nb_samples,
      };
      if (t.video) {
        track.video = { width: t.video.width, height: t.video.height };
        videoTrackIds.push(t.id);
        // Extract codec config (avcC/hvcC) from the track's stsd entry
        track.description = extractCodecDescription(file, t.id);
      }
      if (t.audio) {
        track.audio = { sampleRate: t.audio.sample_rate, channelCount: t.audio.channel_count };
        audioTrackIds.push(t.id);
      }
      tracks.push(track);
    }

    callbacks.onEvent({
      type: "ready",
      tracks,
      isFragmented: info.isFragmented,
    });

    // Use smaller sample batches for lower latency (30 vs 100)
    for (const id of [...videoTrackIds, ...audioTrackIds]) {
      file.setExtractionOptions(id, null, { nbSamples: 30 });
    }

    file.start();
  };

  file.onSamples = (id: number, _user: unknown, samples: MP4Box.Sample[]) => {
    if (stopped) return;

    const demuxed: DemuxerSample[] = [];
    for (const s of samples) {
      if (!s.data) continue;
      demuxed.push({
        data: s.data.buffer.slice(s.data.byteOffset, s.data.byteOffset + s.data.byteLength),
        dts: s.dts,
        cts: s.cts,
        duration: s.duration,
        isRap: s.is_sync,
        trackId: id,
      });
    }

    if (demuxed.length > 0) {
      callbacks.onEvent({ type: "samples", samples: demuxed });
    }
    file.releaseUsedSamples(id, samples[samples.length - 1].number + 1);
  };

  let retries = 0;
  let offset = 0;
  let totalSize = 0;

  try {
    const headRes = await fetch(url, { method: "HEAD", signal });
    const cl = headRes.headers.get("content-length");
    totalSize = cl ? parseInt(cl, 10) : 0;
  } catch { totalSize = 0; }

  while (!stopped) {
    const end = totalSize > 0 ? Math.min(offset + CHUNK_SIZE, totalSize) : offset + CHUNK_SIZE;
    try {
      const res = await fetch(url, {
        headers: { Range: `bytes=${offset}-${end - 1}` },
        signal,
      });
      if (!res.ok && res.status !== 206) {
        throw new Error(`HTTP ${res.status} fetching range`);
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength === 0) break;

      const mp4Buf = MP4Box.MP4BoxBuffer.fromArrayBuffer(buf, offset);
      const next = file.appendBuffer(mp4Buf);
      offset = next > 0 ? next : offset + buf.byteLength;

      callbacks.onProgress?.(offset, totalSize);

      if (buf.byteLength < CHUNK_SIZE) break;
      if (totalSize > 0 && offset >= totalSize) break;

      retries = 0;
    } catch (err: any) {
      if (err?.name === "AbortError" || stopped) break;
      retries++;
      if (retries >= MAX_RETRIES) {
        callbacks.onEvent({
          type: "error",
          message: `Fetch failed after ${MAX_RETRIES} retries: ${err?.message ?? "unknown"}`,
        });
        return;
      }
      await sleep(RETRY_DELAY);
    }

    await sleep(0);
  }

  if (!stopped) {
    file.flush();
    callbacks.onEvent({ type: "done" });
  }
}

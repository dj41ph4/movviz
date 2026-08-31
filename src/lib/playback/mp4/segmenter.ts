/**
 * MP4 → fragmented MP4 segmenter (server-side, no FFmpeg).
 *
 * Reads the moov of a progressive MP4 over Range requests, builds:
 *  - a manifest: codecs, timescales, per-track segment map (2-4s, video
 *    segments aligned on keyframes via stss), keyframe index for seek
 *  - fMP4 init segments (ftyp + moov in fragmented form, source stsd
 *    entries reused verbatim — codec configs never re-parsed)
 *  - fMP4 media segments (moof + mdat) whose sample payloads are sliced
 *    from the source file byte ranges — the video bitstream is IDENTICAL
 *    to the source (zero re-encode).
 *
 * Scope: progressive MP4 (moov-based sample tables). Fragmented sources
 * (moof) or any parse anomaly → returns null, the orchestrator falls back.
 */

const SEGMENT_TARGET_SEC = 4;

export interface Mp4SampleTables {
  dts: number[];        // track timescale units
  cts: number[];        // presentation offset from dts (track timescale)
  duration: number[];
  size: number[];
  offset: number[];     // absolute byte offset in file
  isKey: boolean[];
}

export interface Mp4Track {
  id: number;
  kind: "video" | "audio";
  timescale: number;
  codec: string;        // avc1.42E01E | hev1.1.6.L93.B0 | av01... | mp4a.40.2 | ac-3 | ec-3 | opus | mp4a.40.34
  width?: number;
  height?: number;
  channels?: number;
  sampleRate?: number;
  stsdEntry: Buffer;    // raw sample entry (size+type+payload) reused in init
  samples: Mp4SampleTables;
}

export interface Mp4Segment {
  index: number;
  firstSample: number;  // inclusive
  lastSample: number;   // inclusive
  startSec: number;
  endSec: number;
  keyframe: boolean;
}

export interface Mp4Manifest {
  durationSec: number;
  video: Mp4Track | null;
  audio: Mp4Track[];
  segments: Record<number, Mp4Segment[]>; // keyed by track id
  sourceUrl: string;
}

/** Simple big-endian buffer reader */
class BoxReader {
  constructor(public buf: Buffer) {}
  u32(off: number): number { return this.buf.readUInt32BE(off); }
  u16(off: number): number { return this.buf.readUInt16BE(off); }
  u64(off: number): bigint { return this.buf.readBigUInt64BE(off); }
  str(off: number, len: number): string { return this.buf.toString("latin1", off, off + len); }
  slice(off: number, len: number): Buffer { return this.buf.subarray(off, off + len); }
}

async function fetchRange(url: string, headers: Record<string, string>, start: number, end: number): Promise<{ buf: Buffer; at: number }> {
  const res = await fetch(url, {
    headers: { ...headers, Range: `bytes=${start}-${end}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status} for range ${start}-${end}`);
  // at = byte offset of buf[0] in the file (206 → start; 200 → server ignored Range)
  return { buf: Buffer.from(await res.arrayBuffer()), at: res.status === 206 ? start : 0 };
}

async function probeFileSize(url: string, headers: Record<string, string>): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: { ...headers, Range: "bytes=0-0" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok || res.status === 206) {
      const cr = res.headers.get("content-range");
      if (cr) {
        const m = /\/\s*(\d+)\s*$/.exec(cr);
        if (m) {
          const n = Number(m[1]);
          if (n > 0) return n;
        }
      }
    }
    const head = await fetch(url, { method: "HEAD", headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (head.ok) {
      const len = Number(head.headers.get("content-length") ?? "0");
      if (len > 0) return len;
    }
    return null;
  } catch {
    return null;
  }
}

/** Walk top-level boxes of a buffer starting at `offset`; calls cb(size, type, offset). */
function walkBoxes(buf: Buffer, offset: number, end: number, cb: (size: number, type: string, bodyOff: number) => void): void {
  let off = offset;
  while (off + 8 <= end) {
    const size = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    if (size < 8) break;
    const bodyOff = off + 8;
    if (type === "wide") {
      off += 8;
      continue;
    }
    cb(size, type, bodyOff);
    off += size;
  }
}

function findBox(buf: Buffer, type: string): Buffer | null {
  let found: Buffer | null = null;
  walkBoxes(buf, 0, buf.length, (size, t, bodyOff) => {
    if (t === type) found = buf.subarray(bodyOff, bodyOff + size - 8);
  });
  return found;
}

function findChild(parent: Buffer, type: string): Buffer | null {
  let found: Buffer | null = null;
  walkBoxes(parent, 0, parent.length, (size, t, bodyOff) => {
    if (t === type) found = parent.subarray(bodyOff, bodyOff + size - 8);
  });
  return found;
}

/**
 * Scan the WHOLE buffer for a child box. Sample-entry layouts vary (ISO
 * SampleEntry vs legacy QuickTime fields differ by 8 bytes) — scanning the
 * entire entry for the 4CC with a valid size is layout-agnostic.
 */
function findChildAnywhere(buf: Buffer, type: string): Buffer | null {
  const needle = Buffer.from(type, "latin1");
  let idx = buf.indexOf(needle);
  while (idx !== -1) {
    if (idx >= 4) {
      const size = buf.readUInt32BE(idx - 4);
      if (size >= 8 && idx - 4 + size <= buf.length) {
        return buf.subarray(idx + 4, idx - 4 + size);
      }
    }
    idx = buf.indexOf(needle, idx + 1);
  }
  return null;
}

function esdsAacCodec(esds: Buffer): string {
  // ES_Descriptor 0x03 ... DecoderConfigDescriptor 0x04 ... DecoderSpecificInfo 0x05
  let off = 4; // skip version/flags
  const descLen = (i: number): [number, number] => {
    let len = 0, n = 0;
    while (n < 4) {
      const b = esds[i + n];
      len = (len << 7) | (b & 0x7f);
      n++;
      if (!(b & 0x80)) break;
    }
    return [len, n];
  };
  const skipDescriptor = (i: number): number => {
    const [len, n] = descLen(i + 1);
    return i + 1 + n + len;
  };
  off = skipDescriptor(off); // ES_Descriptor
  if (esds[off] === 0x04) {
    off = skipDescriptor(off); // DecoderConfigDescriptor
    if (esds[off] === 0x05) {
      const [, n] = descLen(off + 1);
      off += 1 + n;
      const aot = esds[off] >> 3;
      if (aot === 2) return "mp4a.40.2";   // AAC-LC
      if (aot === 5) return "mp4a.40.5";   // HE-AAC
      if (aot === 29) return "mp4a.40.29"; // HE-AAC v2
      return "mp4a.40.2";
    }
  }
  return "mp4a.40.2";
}

function avcCodec(avcC: Buffer): string {
  const profile = avcC[1];
  const constraints = avcC[2];
  const level = avcC[3];
  return `avc1.${profile.toString(16).padStart(2, "0")}${constraints.toString(16).padStart(2, "0")}${level.toString(16).padStart(2, "0")}`;
}

function hevcCodec(hvcC: Buffer): string {
  const b0 = hvcC[0];
  const profileSpace = b0 >> 6; // 0-3 → "" / "A" / "B" / "C"
  const tier = (b0 >> 5) & 1;
  const profileIdc = b0 & 0x1f;
  const compat = hvcC.readUInt32BE(1);
  const level = hvcC[5];
  const space = profileSpace === 1 ? "A" : profileSpace === 2 ? "B" : profileSpace === 3 ? "C" : "";
  const compatStr = compat.toString(16).replace(/0+$/, "");
  const tierStr = tier ? "H" : "L";
  return `hev1.${space}${profileIdc}.${compatStr || "0"}.${tierStr}${level.toString(16).toUpperCase()}`;
}

function av1Codec(av1C: Buffer): string {
  const b1 = av1C[1];
  const profile = b1 >> 5;
  const level = b1 & 0x1f;
  const b2 = av1C[2];
  const tier = (b2 >> 7) ? "H" : "M";
  const high = (b2 >> 6) & 1;
  const twelve = (b2 >> 5) & 1;
  const bitDepth = twelve ? 12 : high ? 10 : 8;
  return `av01.${profile}.${level.toString(16).padStart(2, "0")}${tier}.${bitDepth.toString().padStart(2, "0")}`;
}

function sampleEntryInfo(entry: Buffer): { type: string; codec: string; width?: number; height?: number; channels?: number; sampleRate?: number } {
  const r = new BoxReader(entry);
  const type = r.str(4, 4);
  // VisualSampleEntry: ISO puts width at 24 / children at 78; legacy QuickTime
  // variants shift by 8. Try the ISO offset, fall back to the shifted one.
  if (type === "avc1" || type === "avc3") {
    const width = r.u16(24) || r.u16(32);
    const height = r.u16(26) || r.u16(34);
    const avcC = findChildAnywhere(entry, "avcC");
    return { type, codec: avcC ? avcCodec(avcC) : "avc1.640028", width, height };
  }
  if (type === "hev1" || type === "hvc1") {
    const width = r.u16(24) || r.u16(32);
    const height = r.u16(26) || r.u16(34);
    const hvcC = findChildAnywhere(entry, "hvcC");
    return { type, codec: hvcC ? hevcCodec(hvcC) : "hev1.1.6.L93.B0", width, height };
  }
  if (type === "av01") {
    const width = r.u16(24) || r.u16(32);
    const height = r.u16(26) || r.u16(34);
    const av1C = findChildAnywhere(entry, "av1C");
    return { type, codec: av1C ? av1Codec(av1C) : "av01.0.05M.08", width, height };
  }
  // AudioSampleEntry: ISO puts channelcount at 16 / samplerate at 24 /
  // children at 28; legacy QuickTime variants shift. Bounds-guarded reads.
  if (type === "mp4a") {
    const channels = r.u16(16) || r.u16(24);
    const sampleRate = (r.u32(24) >>> 16) || (r.u32(32) >>> 16);
    const esds = findChildAnywhere(entry, "esds");
    return { type, codec: esds ? esdsAacCodec(esds) : "mp4a.40.2", channels, sampleRate };
  }
  if (type === "ac-3") {
    const channels = r.u16(16) || r.u16(24);
    const sampleRate = (r.u32(24) >>> 16) || (r.u32(32) >>> 16);
    return { type, codec: "ac-3", channels, sampleRate };
  }
  if (type === "ec-3") {
    const channels = r.u16(16) || r.u16(24);
    const sampleRate = (r.u32(24) >>> 16) || (r.u32(32) >>> 16);
    return { type, codec: "ec-3", channels, sampleRate };
  }
  if (type === "Opus") {
    const channels = r.u16(16) || r.u16(24);
    return { type, codec: "opus", channels, sampleRate: 48000 };
  }
  return { type, codec: type };
}

interface ParsedTrack {
  id: number;
  kind: "video" | "audio";
  timescale: number;
  sampleEntry: Buffer;
  stsdInfo: ReturnType<typeof sampleEntryInfo>;
  dts: number[];
  cts: number[];
  duration: number[];
  size: number[];
  offset: number[];
  isKey: boolean[];
}

export async function buildManifest(
  sourceUrl: string,
  headers: Record<string, string>,
): Promise<Mp4Manifest | null> {
  try {
    // 1. size — Range GET 0-0 (Content-Range total), HEAD as fallback
    const total = await probeFileSize(sourceUrl, headers);
    if (!total) return null;

    // 2. moov — usually at the end for progressive files; probe last 4 MB,
    //    and retry a full-file scan if not found (small files).
    const probeSize = Math.min(total, 4 * 1024 * 1024);
    const tail = await fetchRange(sourceUrl, headers, Math.max(0, total - probeSize), total - 1);
    let moov = scanForMoov(tail.buf, total - probeSize);
    if (!moov) {
      const head = await fetchRange(sourceUrl, headers, 0, Math.min(total - 1, probeSize - 1));
      moov = scanForMoov(head.buf, 0);
    }
    if (!moov) return null;
    // walkers iterate container children — strip the box header
    const moovBody = moov.subarray(8);

    // 3. parse tracks
    const mvhd = findBox(moovBody, "mvhd");
    const movieTimescale = mvhd ? new BoxReader(mvhd).u32(mvhd[0] === 1 ? 20 : 12) : 1000;
    const tracks: ParsedTrack[] = [];

    walkBoxes(moovBody, 0, moovBody.length, (_s1, t1, o1) => {
      if (t1 !== "trak") return;
      const trak = moovBody.subarray(o1, o1 + _s1 - 8);
      const tkhd = findChild(trak, "tkhd");
      if (!tkhd) return;
      const tkR = new BoxReader(tkhd);
      const trackId = tkhd[0] === 1 ? tkR.u32(20) : tkR.u32(12);
      const mdia = findChild(trak, "mdia");
      if (!mdia) return;
      const mdhd = findChild(mdia, "mdhd");
      const timescale = mdhd ? new BoxReader(mdhd).u32(mdhd[0] === 1 ? 20 : 12) : 1000;
      const hdlr = findChild(mdia, "hdlr");
      const kind = hdlr && hdlr.length > 8 ? (hdlr.subarray(8, 12).toString("latin1") === "soun" ? "audio" : "video") : "video";
      const minf = findChild(mdia, "minf");
      const stbl = minf ? findChild(minf, "stbl") : null;
      if (!stbl) return;
      const stsd = findChild(stbl, "stsd");
      if (!stsd || stsd.length < 8) return;
      if (new BoxReader(stsd).u32(4) < 1) return; // entry_count
      const entryBody = stsd.subarray(8);
      const entrySize = new BoxReader(entryBody).u32(0);
      if (entrySize < 8 || entrySize > entryBody.length) return;
      const entry = entryBody.subarray(0, entrySize);
      const stsdInfo = sampleEntryInfo(entry);

      const stts = findChild(stbl, "stts");
      const stss = findChild(stbl, "stss");
      const stsc = findChild(stbl, "stsc");
      const stsz = findChild(stbl, "stsz");
      const stco = findChild(stbl, "stco") ?? findChild(stbl, "co64");
      const ctts = findChild(stbl, "ctts");
      if (!stts || !stsc || !stsz || !stco) return;

      // per-sample sizes
      const szR = new BoxReader(stsz);
      const uniform = szR.u32(4);
      const sampleCount = szR.u32(8);
      if (sampleCount === 0) return;
      const sizes: number[] = [];
      for (let i = 0; i < sampleCount; i++) sizes.push(uniform > 0 ? uniform : szR.u32(12 + i * 4));

      // per-sample offsets: chunks via stsc + stco (stsc entries at body offset 8)
      const scR = new BoxReader(stsc);
      const chunkCount = scR.u32(4);
      const chunkToSamples: Array<{ start: number; count: number }> = [];
      let lastStart = 1, lastCount = 0;
      for (let i = 0; i < chunkCount; i++) {
        const first = scR.u32(8 + i * 12);
        const count = scR.u32(12 + i * 12);
        if (i > 0) chunkToSamples.push({ start: lastStart, count: lastCount });
        lastStart = first;
        lastCount = count;
      }
      chunkToSamples.push({ start: lastStart, count: lastCount });

      const coR = new BoxReader(stco);
      const co64 = !!findChild(stbl, "co64");
      const coCount = coR.u32(4);
      const chunkOffsets: number[] = [];
      for (let i = 0; i < coCount; i++) {
        chunkOffsets.push(co64 ? Number(coR.u64(8 + i * 8)) : coR.u32(8 + i * 4));
      }

      const offsets: number[] = new Array(sampleCount);
      const dts: number[] = new Array(sampleCount);
      const duration: number[] = new Array(sampleCount);
      let sampleIdx = 0;
      let runningDts = 0;
      // stsc entries describe runs: entry {start,count} applies to every chunk
      // from `start` until the next entry's start. Advance the cursor per chunk.
      let stscCursor = 0;
      for (let c = 0; c < chunkOffsets.length; c++) {
        while (stscCursor + 1 < chunkToSamples.length && chunkToSamples[stscCursor + 1].start <= c + 1) stscCursor++;
        const count = chunkToSamples[stscCursor].count;
        let off = chunkOffsets[c];
        for (let s = 0; s < count && sampleIdx < sampleCount; s++) {
          offsets[sampleIdx] = off;
          off += sizes[sampleIdx];
          sampleIdx++;
        }
      }
      // stts → dts + durations (entries at body offset 8)
      const ttR = new BoxReader(stts);
      const ttCount = ttR.u32(4);
      let dtsIdx = 0;
      for (let i = 0; i < ttCount; i++) {
        const cnt = ttR.u32(8 + i * 8);
        const delta = ttR.u32(12 + i * 8);
        for (let j = 0; j < cnt && dtsIdx < sampleCount; j++) {
          dts[dtsIdx] = runningDts;
          duration[dtsIdx] = delta;
          runningDts += delta;
          dtsIdx++;
        }
      }
      // stss → keyframes (1-based)
      const isKey: boolean[] = new Array(sampleCount).fill(false);
      if (kind === "video" && stss) {
        const ssR = new BoxReader(stss);
        const ssCount = ssR.u32(4);
        for (let i = 0; i < ssCount; i++) {
          const n = ssR.u32(8 + i * 4);
          if (n >= 1 && n <= sampleCount) isKey[n - 1] = true;
        }
      } else {
        isKey.fill(true);
      }
      // ctts → cts
      const cts: number[] = new Array(sampleCount).fill(0);
      if (ctts) {
        const ctR = new BoxReader(ctts);
        const ctCount = ctR.u32(4);
        let ci = 0;
        for (let i = 0; i < ctCount; i++) {
          const cnt = ctR.u32(12 + i * 8);
          const delta = ctR.u32(16 + i * 8);
          for (let j = 0; j < cnt && ci < sampleCount; j++) {
            cts[ci] = delta;
            ci++;
          }
        }
      }

      // sanity: every sample must resolve (missing stco/stts coverage → broken track)
      for (let i = 0; i < sampleCount; i++) {
        if (!Number.isFinite(offsets[i]) || !Number.isFinite(dts[i]) || !Number.isFinite(duration[i]) || !Number.isFinite(sizes[i])) return;
      }

      tracks.push({
        id: trackId,
        kind: kind === "audio" ? "audio" : "video",
        timescale,
        sampleEntry: entry,
        stsdInfo,
        dts, cts, duration, size: sizes, offset: offsets, isKey,
      });
    });

    if (tracks.length === 0) return null;
    const video = tracks.find((t) => t.kind === "video");
    if (!video) return null;
    const audio = tracks.filter((t) => t.kind === "audio");
    if (audio.length === 0) return null;

    // 4. duration + segment map (per track, ~4s, keyframe-aligned for video)
    const videoDurationTs = video.dts[video.dts.length - 1] + video.duration[video.duration.length - 1];
    const durationSec = videoDurationTs / video.timescale;
    const segments: Record<number, Mp4Segment[]> = {};
    for (const trk of tracks) {
      const list: Mp4Segment[] = [];
      const target = Math.round(SEGMENT_TARGET_SEC * trk.timescale);
      let start = 0;
      let segIdx = 0;
      while (start < trk.dts.length) {
        const startSec = trk.dts[start] / trk.timescale;
        let end = start + 1;
        let boundary = trk.dts[start] + target;
        // extend to keyframe boundary ≥ target
        while (end < trk.dts.length) {
          if (trk.kind === "video" && trk.isKey[end] && trk.dts[end] >= boundary) break;
          if (trk.dts[end] >= boundary + target) break;
          end++;
        }
        list.push({
          index: segIdx,
          firstSample: start,
          lastSample: end - 1,
          startSec,
          endSec: (trk.dts[end - 1] + trk.duration[end - 1]) / trk.timescale,
          keyframe: trk.isKey[start],
        });
        start = end;
        segIdx++;
      }
      segments[trk.id] = list;
    }

    return {
      durationSec,
      video: toMp4Track(video),
      audio: audio.map(toMp4Track),
      segments,
      sourceUrl,
    };
  } catch {
    return null;
  }
}

function toMp4Track(t: ParsedTrack): Mp4Track {
  return {
    id: t.id,
    kind: t.kind,
    timescale: t.timescale,
    codec: t.stsdInfo.codec,
    width: t.stsdInfo.width,
    height: t.stsdInfo.height,
    channels: t.stsdInfo.channels,
    sampleRate: t.stsdInfo.sampleRate,
    stsdEntry: t.sampleEntry,
    samples: {
      dts: t.dts,
      cts: t.cts,
      duration: t.duration,
      size: t.size,
      offset: t.offset,
      isKey: t.isKey,
    },
  };
}

function scanForMoov(buf: Buffer, baseOffset: number): Buffer | null {
  let found: Buffer | null = null;
  const search = Buffer.from("moov");
  let idx = buf.indexOf(search);
  while (idx !== -1) {
    if (idx >= 4) {
      const size = buf.readUInt32BE(idx - 4);
      // box starts at idx-4, ends at idx-4+size
      if (size >= 8 && idx - 4 + size <= buf.length) {
        found = buf.subarray(idx - 4, idx - 4 + size);
        break;
      }
    }
    idx = buf.indexOf(search, idx + 1);
  }
  return found;
}

/** Build a fragmented init segment: ftyp + moov(mvex/trex, stsd from source). */
export function buildInitSegment(manifest: Mp4Manifest, track: Mp4Track): Buffer {
  // One track per init segment — a SourceBuffer must not mix video+audio tracks.
  const moov = moovBox([track], manifest.durationSec);
  return Buffer.concat([ftypBox(), moov]);
}

function ftypBox(): Buffer {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(24, 0);
  b.write("ftyp", 4);
  b.write("isom", 8);
  b.writeUInt32BE(0x200, 12);
  b.write("isom", 16);
  b.write("iso6", 20);
  return b;
}

function fullBox(buf: Buffer, type: string, version: number, flags: number): void {
  buf.write(type, 4);
  buf[8] = version;
  buf.writeUInt32BE(flags, 9);
}

function moovBox(tracks: Mp4Track[], durationSec: number): Buffer {
  const trakBoxes = tracks.map(trakBox);
  const mvex = mvexBox(tracks);
  const total = 8 + 108 + trakBoxes.reduce((a, b) => a + b.length, 0) + mvex.length;
  const moov = Buffer.alloc(total);
  moov.writeUInt32BE(total, 0);
  moov.write("moov", 4);
  // mvhd (version 0, 108 bytes)
  let off = 8;
  moov.writeUInt32BE(108, off);
  moov.write("mvhd", off + 4);
  moov[off + 8] = 0; // version
  moov.writeUInt32BE(0, off + 9); // flags (3B) + creation_time high byte (creation=0)
  moov.writeUInt32BE(0, off + 12); // creation_time
  moov.writeUInt32BE(0, off + 16); // modification_time
  moov.writeUInt32BE(1000, off + 20); // timescale
  moov.writeUInt32BE(Math.round(durationSec * 1000), off + 24); // duration
  moov.writeUInt32BE(0x00010000, off + 28); // rate
  moov.writeUInt16BE(0x0100, off + 32); // volume
  moov.writeUInt16BE(0, off + 34); // reserved
  moov.writeUInt32BE(0, off + 36); // reserved
  moov.writeUInt32BE(0, off + 40); // reserved
  for (let i = 0; i < 9; i++) moov.writeUInt32BE(i % 3 === 0 ? 0x00010000 : 0, off + 44 + i * 4); // matrix
  moov.writeUInt32BE(0x40000000, off + 76); // matrix[8]
  for (let i = 0; i < 6; i++) moov.writeUInt32BE(0, off + 80 + i * 4); // pre_defined
  moov.writeUInt32BE(tracks.length + 1, off + 104); // next_track_ID
  off += 108;

  for (const t of trakBoxes) {
    t.copy(moov, off);
    off += t.length;
  }
  mvex.copy(moov, off);
  return moov;
}

function trakBox(t: Mp4Track): Buffer {
  const stsd = stsdBox(t);
  const stbl = stblBox(stsd);
  const minf = minfBox(t.kind, stbl);
  const mdia = mdiaBox(t, minf);
  const tkhd = tkhdBox(t);
  const total = 8 + tkhd.length + mdia.length;
  const trak = Buffer.alloc(total);
  trak.writeUInt32BE(total, 0);
  trak.write("trak", 4);
  tkhd.copy(trak, 8);
  mdia.copy(trak, 8 + tkhd.length);
  return trak;
}

function tkhdBox(t: Mp4Track): Buffer {
  const b = Buffer.alloc(92);
  b.writeUInt32BE(92, 0);
  b.write("tkhd", 4);
  b[8] = 0; // version
  b[9] = 0;
  b[10] = 0;
  b[11] = 3; // flags: enabled + in-movie
  b.writeUInt32BE(0, 12); // creation_time
  b.writeUInt32BE(0, 16); // modification_time
  b.writeUInt32BE(t.id, 20); // track_ID
  b.writeUInt32BE(0, 24); // reserved
  b.writeUInt32BE(0, 28); // duration
  b.writeUInt32BE(0, 32); // reserved
  b.writeUInt32BE(0, 36); // reserved
  b.writeUInt16BE(0, 40); // layer
  b.writeUInt16BE(0, 42); // alternate_group
  b.writeUInt16BE(0x0100, 44); // volume
  b.writeUInt16BE(0, 46); // reserved
  for (let i = 0; i < 9; i++) b.writeUInt32BE(i % 3 === 0 ? 0x00010000 : 0, 48 + i * 4); // matrix
  b.writeUInt32BE(0x40000000, 80); // matrix[8]
  b.writeUInt32BE((t.width ?? 1920) << 16, 84); // width 16.16
  b.writeUInt32BE((t.height ?? 1080) << 16, 88); // height 16.16
  return b;
}

function mdiaBox(t: Mp4Track, minf: Buffer): Buffer {
  const mdhd = mdhdBox(t);
  const hdlr = hdlrBox(t.kind);
  const total = 8 + mdhd.length + hdlr.length + minf.length;
  const b = Buffer.alloc(total);
  b.writeUInt32BE(total, 0);
  b.write("mdia", 4);
  mdhd.copy(b, 8);
  hdlr.copy(b, 8 + mdhd.length);
  minf.copy(b, 8 + mdhd.length + hdlr.length);
  return b;
}

function mdhdBox(t: Mp4Track): Buffer {
  const b = Buffer.alloc(32);
  b.writeUInt32BE(32, 0);
  b.write("mdhd", 4);
  fullBox(b.subarray(0), "", 0, 0);
  b.writeUInt32BE(0, 12);
  b.writeUInt32BE(0, 16);
  b.writeUInt32BE(t.timescale, 20);
  b.writeUInt32BE(0, 24);
  b.writeUInt16BE(0x55c4, 28); // und
  b.writeUInt16BE(0, 30);
  return b;
}

function hdlrBox(kind: "video" | "audio"): Buffer {
  const b = Buffer.alloc(33);
  b.writeUInt32BE(33, 0);
  b.write("hdlr", 4);
  fullBox(b.subarray(0), "", 0, 0);
  b.writeUInt32BE(0, 12);
  b.write(kind === "video" ? "vide" : "soun", 16);
  b.writeUInt32BE(0, 20);
  b.writeUInt32BE(0, 24);
  b.writeUInt32BE(0, 28);
  b[32] = 0;
  return b;
}

function minfBox(kind: "video" | "audio", stbl: Buffer): Buffer {
  const vmhd = kind === "video" ? Buffer.from([0, 0, 0, 0x20, 0x76, 0x6d, 0x68, 0x64, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) : Buffer.from([0, 0, 0, 0x14, 0x73, 0x6d, 0x68, 0x64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const dref = Buffer.concat([
    Buffer.from([0, 0, 0, 0x1c, 0x64, 0x72, 0x65, 0x66, 0, 0, 0, 0, 0, 0, 0, 1]),
    Buffer.from([0, 0, 0, 0x0c, 0x75, 0x72, 0x6c, 0x20, 0, 0, 0, 1]),
  ]);
  const total = 8 + vmhd.length + dref.length + stbl.length;
  const b = Buffer.alloc(total);
  b.writeUInt32BE(total, 0);
  b.write("minf", 4);
  vmhd.copy(b, 8);
  dref.copy(b, 8 + vmhd.length);
  stbl.copy(b, 8 + vmhd.length + dref.length);
  return b;
}

function stblBox(stsd: Buffer): Buffer {
  // Empty sample tables — in fragmented files the sample info lives in
  // trex/tfhd/tfdt/trun. entry_count = 0, no children.
  const stts = Buffer.from([0, 0, 0, 16, 0x73, 0x74, 0x74, 0x73, 0, 0, 0, 0, 0, 0, 0, 0]);
  const stsc = Buffer.from([0, 0, 0, 16, 0x73, 0x74, 0x73, 0x63, 0, 0, 0, 0, 0, 0, 0, 0]);
  const stsz = Buffer.from([0, 0, 0, 20, 0x73, 0x74, 0x73, 0x7a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const stco = Buffer.from([0, 0, 0, 16, 0x73, 0x74, 0x63, 0x6f, 0, 0, 0, 0, 0, 0, 0, 0]);
  const boxes = [stsd, stts, stsc, stsz, stco];
  const total = 8 + boxes.reduce((a, b) => a + b.length, 0);
  const b = Buffer.alloc(total);
  b.writeUInt32BE(total, 0);
  b.write("stbl", 4);
  let off = 8;
  for (const box of boxes) {
    box.copy(b, off);
    off += box.length;
  }
  return b;
}

function stsdBox(t: Mp4Track): Buffer {
  const entry = t.stsdEntry;
  const total = 8 + 8 + 4 + entry.length;
  const b = Buffer.alloc(total);
  b.writeUInt32BE(total, 0);
  b.write("stsd", 4);
  fullBox(b.subarray(0), "", 0, 0);
  b.writeUInt32BE(1, 12);
  entry.copy(b, 16);
  return b;
}

function mvexBox(tracks: Mp4Track[]): Buffer {
  const trexs = tracks.map((t) => {
    const b = Buffer.alloc(32);
    b.writeUInt32BE(32, 0);
    b.write("trex", 4);
    b[8] = 0; // version
    b.writeUInt32BE(0, 9); // flags
    b.writeUInt32BE(t.id, 12); // track_ID
    b.writeUInt32BE(1, 16); // default_sample_description_index
    b.writeUInt32BE(0, 20); // default_sample_duration
    b.writeUInt32BE(0, 24); // default_sample_size
    b.writeUInt32BE(0x01010000, 28); // default_sample_flags (non-sync)
    return b;
  });
  const total = 8 + trexs.reduce((a, b) => a + b.length, 0);
  const b = Buffer.alloc(total);
  b.writeUInt32BE(total, 0);
  b.write("mvex", 4);
  let off = 8;
  for (const trex of trexs) {
    trex.copy(b, off);
    off += trex.length;
  }
  return b;
}

/** Build a media segment: moof (mfhd, traf: tfhd+tfdt+trun) + mdat with the sample payloads. */
export async function buildMediaSegment(
  manifest: Mp4Manifest,
  track: Mp4Track,
  segment: Mp4Segment,
  headers: Record<string, string>,
): Promise<Buffer> {
  const samples = track.samples;
  const n = segment.lastSample - segment.firstSample + 1;
  const startOff = samples.offset[segment.firstSample];
  const lastOff = samples.offset[segment.lastSample] + samples.size[segment.lastSample];
  const range = await fetchRange(manifest.sourceUrl, headers, startOff, lastOff - 1);
  const base = range.at === startOff ? startOff : 0;
  if (range.buf.length < lastOff - base) throw new Error("short media payload");
  const chunks: Buffer[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const idx = segment.firstSample + i;
    const local = samples.offset[idx] - base;
    chunks[i] = range.buf.subarray(local, local + samples.size[idx]);
  }

  const mfhd = Buffer.alloc(16);
  mfhd.writeUInt32BE(16, 0);
  mfhd.write("mfhd", 4);
  mfhd.writeUInt32BE(0, 8); // version 0 + flags
  mfhd.writeUInt32BE(segment.index + 1, 12); // sequence_number

  const tfhd = Buffer.alloc(20);
  tfhd.writeUInt32BE(20, 0);
  tfhd.write("tfhd", 4);
  tfhd.writeUInt32BE(0x00020002, 8); // version 0 + flags: default-base-is-moof + sample-desc-index-present
  tfhd.writeUInt32BE(track.id, 12);
  tfhd.writeUInt32BE(1, 16); // sample_description_index

  const tfdt = Buffer.alloc(20);
  tfdt.writeUInt32BE(20, 0);
  tfdt.write("tfdt", 4);
  tfdt.writeUInt32BE(0x01000000, 8); // version 1
  tfdt.writeBigUInt64BE(BigInt(samples.dts[segment.firstSample]), 12);

  // trun (v1): data-offset + per-sample dur/size/flags/cto.
  // No first-sample-flags field → header = vf(4) + count(4) + dataOffset(4).
  const trunSize = 20 + n * 16;
  const trun = Buffer.alloc(trunSize);
  trun.writeUInt32BE(trunSize, 0);
  trun.write("trun", 4);
  trun.writeUInt32BE(0x01000f01, 8); // version 1 + flags: data-offset + dur/size/flags/cto
  trun.writeUInt32BE(n, 12);
  const dataOffsetPos = 16;
  const moofSize = 8 + mfhd.length + 8 + (20 + 20 + trunSize);
  trun.writeUInt32BE(moofSize + 8, dataOffsetPos); // moof end + mdat header, relative to moof start
  let off = 20;
  for (let i = 0; i < n; i++) {
    const idx = segment.firstSample + i;
    trun.writeUInt32BE(samples.duration[idx], off);
    trun.writeUInt32BE(samples.size[idx], off + 4);
    trun.writeUInt32BE(samples.isKey[idx] ? 0x02000000 : 0x01010000, off + 8);
    trun.writeInt32BE(samples.cts[idx], off + 12);
    off += 16;
  }

  const traf = Buffer.alloc(8 + tfhd.length + tfdt.length + trun.length);
  traf.writeUInt32BE(traf.length, 0);
  traf.write("traf", 4);
  tfhd.copy(traf, 8);
  tfdt.copy(traf, 8 + tfhd.length);
  trun.copy(traf, 8 + tfhd.length + tfdt.length);
  const mdatData = Buffer.concat(chunks);
  const mdatSize = 8 + mdatData.length;

  const moof = Buffer.alloc(moofSize);
  moof.writeUInt32BE(moofSize, 0);
  moof.write("moof", 4);
  mfhd.copy(moof, 8);
  traf.copy(moof, 8 + mfhd.length);

  const mdat = Buffer.alloc(mdatSize);
  mdat.writeUInt32BE(mdatSize, 0);
  mdat.write("mdat", 4);
  mdatData.copy(mdat, 8);

  return Buffer.concat([moof, mdat]);
}

/** Convert a time (seconds) to the track's closest segment. */
export function segmentAtTime(segments: Mp4Segment[], timeSec: number, preferKeyframe: boolean): Mp4Segment | null {
  let best: Mp4Segment | null = null;
  for (const s of segments) {
    if (s.startSec > timeSec) break;
    if (preferKeyframe && !s.keyframe) continue;
    if (!best || s.startSec > best.startSec) best = s;
  }
  return best;
}

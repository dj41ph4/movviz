import { deflateSync, inflateSync } from "node:zlib";

/**
 * A title logo drawn in black (« Death Note Kaï » in the Fan-Kai pack) is
 * invisible over Movviz's dark hero and cards. This turns such a logo white,
 * keeping its transparency — the shape stays, only the ink changes. Colored
 * and light logos are returned untouched.
 *
 * Pure JS (zlib only): the server must not depend on a native image library
 * that the standalone build may not ship on every platform. Handles the
 * 8-bit, non-interlaced PNGs logos use (RGBA, RGB, grey, grey+alpha,
 * palette); anything else is returned as is.
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Average luminance (0-255) of the opaque pixels below which a logo counts as dark. */
const DARK_LUMINANCE = 60;
/** Above this many pixels, decoding is not worth it (a logo is never that big). */
const MAX_PIXELS = 25_000_000;

interface Decoded { width: number; height: number; rgba: Buffer }

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function decodePng(png: Buffer): Decoded | null {
  if (png.length < 33 || !png.subarray(0, 8).equals(SIGNATURE)) return null;
  let width = 0, height = 0, depth = 0, colorType = 0, interlace = 0;
  let palette: Buffer | null = null;
  let alphas: Buffer | null = null;
  const idat: Buffer[] = [];
  for (let at = 8; at + 8 <= png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") alphas = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (!channels || depth !== 8 || interlace !== 0 || !width || !height || width * height > MAX_PIXELS) return null;
  if (colorType === 3 && !palette) return null;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) return null;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = y * stride;
    const prev = y > 0 ? out - stride : -1;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[out + x - channels] : 0;
      const up = prev >= 0 ? pixels[prev + x] : 0;
      const upLeft = prev >= 0 && x >= channels ? pixels[prev + x - channels] : 0;
      const value = line[x];
      pixels[out + x] = (filter === 0 ? value
        : filter === 1 ? value + left
        : filter === 2 ? value + up
        : filter === 3 ? value + ((left + up) >> 1)
        : filter === 4 ? value + paeth(left, up, upLeft)
        : value) & 0xff;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++, p += channels) {
    const o = i * 4;
    if (colorType === 6) { rgba[o] = pixels[p]; rgba[o + 1] = pixels[p + 1]; rgba[o + 2] = pixels[p + 2]; rgba[o + 3] = pixels[p + 3]; }
    else if (colorType === 2) { rgba[o] = pixels[p]; rgba[o + 1] = pixels[p + 1]; rgba[o + 2] = pixels[p + 2]; rgba[o + 3] = 255; }
    else if (colorType === 0) { rgba[o] = rgba[o + 1] = rgba[o + 2] = pixels[p]; rgba[o + 3] = 255; }
    else if (colorType === 4) { rgba[o] = rgba[o + 1] = rgba[o + 2] = pixels[p]; rgba[o + 3] = pixels[p + 1]; }
    else {
      const index = pixels[p];
      rgba[o] = palette![index * 3] ?? 0; rgba[o + 1] = palette![index * 3 + 1] ?? 0; rgba[o + 2] = palette![index * 3 + 2] ?? 0;
      rgba[o + 3] = alphas && index < alphas.length ? alphas[index] : 255;
    }
  }
  return { width, height, rgba };
}

// zlib.crc32 only exists from Node 22.2: a table keeps every runtime working.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

export function encodePng({ width, height, rgba }: Decoded): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/** Average luminance of the opaque pixels, null when the image has none. */
export function opaqueLuminance({ rgba }: Decoded): number | null {
  let sum = 0, count = 0;
  for (let o = 0; o < rgba.length; o += 4) {
    if (rgba[o + 3] < 128) continue;
    sum += 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
    count++;
  }
  return count ? sum / count : null;
}

/**
 * The logo, white if it is dark ink on a transparent background; otherwise
 * the very same buffer. A dark logo WITHOUT transparency (black on a white
 * box) is left alone: whitening it would erase it.
 */
export function lightenDarkLogo(png: Buffer): Buffer {
  let decoded: Decoded | null;
  try { decoded = decodePng(png); } catch { return png; }
  if (!decoded) return png;
  const { rgba } = decoded;
  let transparent = 0;
  for (let o = 3; o < rgba.length; o += 4) if (rgba[o] < 128) transparent++;
  if (transparent < rgba.length / 4 / 10) return png;
  const luminance = opaqueLuminance(decoded);
  if (luminance == null || luminance >= DARK_LUMINANCE) return png;
  for (let o = 0; o < rgba.length; o += 4) { rgba[o] = 255; rgba[o + 1] = 255; rgba[o + 2] = 255; }
  return encodePng(decoded);
}

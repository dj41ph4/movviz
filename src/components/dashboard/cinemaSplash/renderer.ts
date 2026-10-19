/**
 * Cinema splash (Beta design) — canvas renderer.
 *
 * The scene is a 1916×821 (21:9) plate. Everything that moves is drawn on top
 * of it in plate coordinates, so overlays stay sharp at any resolution:
 *  - the plate's own emissive lines (ceiling, pillars, floor, outline of the
 *    play triangle…) were extracted at full resolution into one "light" layer
 *    per family. Light travels along each family through a soft moving band —
 *    it follows the pixels of the lines;
 *  - light is additive and always fades to 0, no rectangular outline can show;
 *  - the wordmark is lit through a mask built from its own pixels.
 * 21:9 shows the whole plate; 16:9 crops the sides; narrower screens keep at
 * least the wordmark visible.
 *
 * The renderer runs in a Web Worker on an OffscreenCanvas (splash.worker.ts), so
 * the page loading underneath never steals its frames; it also runs on the main
 * thread as a fallback. It therefore never touches the DOM: images arrive as
 * ImageBitmaps, and the localised texts as a bitmap rasterised by the page
 * (where the web font lives). Per-frame cost is kept low: one composite per
 * light family, pre-rendered glow sprites (no gradient built per frame), a
 * vignette cached per size, and a capped backing store (see `splashLayout`).
 */
import { SPLASH_MANIFEST, splashAsset, type SplashFamily, type SplashManifest } from "./assets";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t: number) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

type Surface = OffscreenCanvas;
type Ctx = OffscreenCanvasRenderingContext2D;
const mk = (w: number, h: number): Surface => new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
const ctx2d = (c: Surface) => c.getContext("2d")!;

/** Region of the plate covered by the text bitmap (tagline + loading label), and its resolution. */
export const TEXT_BAND = { y0: 430, y1: 600, scale: 2 } as const;
const MIN_VISIBLE_W = 780;

/**
 * Backing-store size and plate scale for a canvas of cssW×cssH. The density is capped (soft light
 * gains nothing from 4K pixels, while the cost grows with every one of them).
 */
export function splashLayout(cssW: number, cssH: number, devicePixelRatio: number) {
  let dpr = Math.min(devicePixelRatio || 1, 1.5);
  const maxPixels = 2560 * 1440;
  if (cssW * dpr * cssH * dpr > maxPixels) dpr = Math.sqrt(maxPixels / Math.max(1, cssW * cssH));
  const pw = Math.max(2, Math.round(cssW * dpr));
  const ph = Math.max(2, Math.round(cssH * dpr));
  const { w, h } = SPLASH_MANIFEST;
  const aspect = pw / ph;
  // wider than the plate: fit the width (crops top/bottom); narrower: crop the sides, but keep the wordmark whole
  const k = aspect >= w / h ? pw / w : pw / Math.max(h * aspect, MIN_VISIBLE_W);
  return { pw, ph, k, kCss: k / dpr };
}

/**
 * Rasterises the localised texts in plate units (page side, where the web font is loaded).
 * Sizes keep a readable minimum on small screens.
 */
export function drawTextLayer(texts: { tagline: string; label: string }, kCss: number, fontFamily: string): ImageBitmap {
  const { cx, tagY, labelY, w } = SPLASH_MANIFEST;
  const S = TEXT_BAND.scale;
  const c = mk(w * S, (TEXT_BAND.y1 - TEXT_BAND.y0) * S);
  const ctx = ctx2d(c);
  ctx.scale(S, S);
  ctx.translate(0, -TEXT_BAND.y0);
  ctx.textBaseline = "middle";

  const tag = texts.tagline.toLocaleUpperCase();
  let tagSize = Math.max(17, 11 / kCss);
  let tagSpacing = Math.max(5, tagSize * 0.4);
  ctx.textAlign = "left";
  const setTag = () => {
    ctx.font = `500 ${tagSize}px ${fontFamily}`;
    ctx.letterSpacing = `${tagSpacing}px`;
  };
  setTag();
  let tagW = ctx.measureText(tag).width;
  const maxTag = 600;
  if (tagW > maxTag) {
    tagSpacing = Math.max(1, tagSpacing * (maxTag / tagW));
    setTag();
    tagW = ctx.measureText(tag).width;
    if (tagW > maxTag) {
      tagSize *= maxTag / tagW;
      setTag();
      tagW = ctx.measureText(tag).width;
    }
  }
  const tx = cx - tagW / 2;
  const tg = ctx.createLinearGradient(tx, 0, tx + tagW, 0);
  tg.addColorStop(0, "#d4cff0");
  tg.addColorStop(1, "#bda7ff");
  ctx.fillStyle = tg;
  ctx.fillText(tag, tx, tagY);

  const labelSize = Math.max(17, 13 / kCss);
  ctx.font = `300 ${labelSize}px ${fontFamily}`;
  ctx.letterSpacing = "2px";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(220,216,240,.88)";
  ctx.fillText(texts.label, cx, labelY);
  return c.transferToImageBitmap();
}

interface Family extends SplashFamily {
  light: ImageBitmap;
  tmp: Surface;
  period: number;
  phase: number;
  /** Length of the travelling band, as a fraction of the family's extent. */
  band: number;
  gain: number;
  /** Scene time at which this layer finished loading (it fades in from there). */
  bornAt: number;
}

type Ember = { x: number; y: number; v: number; s: number; sw: number; f: number; a: number };

/** Per-family rhythm: slightly different periods so the lights never line up twice. */
const RHYTHM: Record<string, { period: number; phase: number; band: number; gain: number }> = {
  tri: { period: 5.2, phase: 0, band: 0.2, gain: 1 },
  beamL: { period: 3.6, phase: 0.1, band: 0.45, gain: 0.9 },
  beamR: { period: 3.6, phase: 0.6, band: 0.45, gain: 0.9 },
  ceilL: { period: 4.1, phase: 0.2, band: 0.32, gain: 1 },
  ceilR: { period: 4.1, phase: 0.7, band: 0.32, gain: 1 },
  pillL: { period: 3.4, phase: 0.35, band: 0.38, gain: 1 },
  pillR: { period: 3.4, phase: 0.85, band: 0.38, gain: 1 },
  floorL: { period: 4.6, phase: 0.5, band: 0.3, gain: 1 },
  floorR: { period: 4.6, phase: 0.05, band: 0.3, gain: 1 },
};

async function loadBitmap(name: string): Promise<ImageBitmap> {
  const res = await fetch(splashAsset(name));
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return createImageBitmap(await res.blob());
}

/** Soft radial light baked once; drawn stretched (round or oval) with any alpha. */
function sprite(stops: [number, string][]): Surface {
  const s = mk(128, 128);
  const g = ctx2d(s);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 61);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return s;
}

export class CinemaSplashRenderer {
  private readonly ctx: Ctx;
  private plate: ImageBitmap | null = null;
  private readonly man: SplashManifest = SPLASH_MANIFEST;
  /** Called each time a light layer arrives (a still scene must then be redrawn). */
  onLayerLoaded: (() => void) | null = null;
  private fams: Family[] = [];
  private ready = false;
  private textLayer: ImageBitmap | null = null;

  private PW = 1916;
  private PH = 821;
  private k = 1;

  private targetProgress = 0;
  private shownProgress = 0;
  private lastT = 0;

  private logoMask!: ImageBitmap;
  private tmpLogo!: Surface;
  private vignette: Surface | null = null;
  private readonly softGlow = sprite([[0, "rgba(150,110,255,1)"], [0.45, "rgba(130,90,255,.35)"], [1, "rgba(120,80,255,0)"]]);
  private readonly hotGlow = sprite([[0, "rgba(240,230,255,1)"], [0.3, "rgba(170,130,255,.5)"], [1, "rgba(130,90,255,0)"]]);
  private embers: Ember[] = [];

  constructor(private readonly canvas: OffscreenCanvas | HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d") as Ctx;
  }

  /** Bitmap from `drawTextLayer`; replaces (and frees) the previous one. */
  setTextLayer(bitmap: ImageBitmap | null) {
    this.textLayer?.close();
    this.textLayer = bitmap;
  }

  /** Real loading progress, 0..100. The bar eases toward it. */
  setProgress(pct: number) {
    this.targetProgress = Number.isFinite(pct) ? clamp(pct / 100) : 0;
  }

  /**
   * Resolves as soon as the plate and the wordmark mask are decoded: the scene is drawn right away.
   * The light layers keep loading in the background and each one fades in when it arrives.
   */
  async load(): Promise<void> {
    // all requests leave together; only the first two gate the first frame
    const pending = this.man.families.map((f) => loadBitmap(`lit_${f.id}.webp`).then((light) => ({ f, light })));
    const [plate, mask] = await Promise.all([loadBitmap("plate.webp"), loadBitmap("logo_mask.png")]);
    this.plate = plate;
    this.logoMask = mask;
    this.tmpLogo = mk(this.man.logo.w, this.man.logo.h);
    this.prepareEmbers();
    this.ready = true;
    for (const job of pending) {
      job
        .then(({ f, light }) => {
          if (!this.plate) return;
          const r = RHYTHM[f.id] ?? { period: 4, phase: 0, band: 0.3, gain: 1 };
          this.fams.push({ ...f, light, tmp: mk(f.rect[2], f.rect[3]), bornAt: this.lastT, ...r });
          this.onLayerLoaded?.();
        })
        .catch(() => {
          /* a missing light layer only removes that light */
        });
    }
  }

  isReady() {
    return this.ready;
  }

  /** Backing-store size in device pixels and plate scale, from `splashLayout`. */
  resize(pw: number, ph: number, k: number) {
    this.PW = pw;
    this.PH = ph;
    this.k = k;
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.vignette = null;
  }

  dispose() {
    this.ready = false;
    this.plate?.close();
    this.plate = null;
    this.textLayer?.close();
    this.textLayer = null;
  }

  /* ───────────────────────────── preparation ───────────────────────────── */

  private prepareEmbers() {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    this.embers = Array.from({ length: 22 }, () => ({
      x: rnd() * this.man.w,
      y: rnd() * this.man.h,
      v: 8 + rnd() * 22,
      s: 0.7 + rnd() * 1.9,
      sw: rnd() * 6.28,
      f: 0.5 + rnd() * 1.6,
      a: 0.16 + rnd() * 0.3,
    }));
  }

  /** Edge vignette (and, on narrow screens, the plate's top/bottom melting into black), cached per size. */
  private getVignette(): Surface {
    if (this.vignette) return this.vignette;
    const { PW, PH, k } = this;
    const v = mk(PW, PH);
    const g = ctx2d(v);
    const plateH = this.man.h * k;
    if (plateH < PH - 2) {
      const m = (PH - plateH) / 2;
      const fade = Math.min(120, plateH * 0.2);
      for (const [y0, dir] of [[m, 1], [PH - m, -1]] as const) {
        const gr = g.createLinearGradient(0, y0, 0, y0 + dir * fade);
        gr.addColorStop(0, "rgba(0,0,0,1)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.fillRect(0, dir > 0 ? y0 : y0 - fade, PW, fade);
      }
    }
    const vg = g.createRadialGradient(PW / 2, PH / 2, Math.min(PW, PH) * 0.42, PW / 2, PH / 2, Math.hypot(PW, PH) * 0.56);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.4)");
    g.fillStyle = vg;
    g.fillRect(0, 0, PW, PH);
    this.vignette = v;
    return v;
  }

  /* ─────────────────────────────── drawing ─────────────────────────────── */

  /** A soft light: the sprite stretched to w×h around (x, y), added to the scene. */
  private glow(spr: Surface, x: number, y: number, w: number, h: number, alpha: number) {
    if (alpha <= 0.002) return;
    const c = this.ctx;
    c.globalAlpha = Math.min(1, alpha);
    c.drawImage(spr, x - w / 2, y - h / 2, w, h);
    c.globalAlpha = 1;
  }

  /**
   * One light family: its layer is multiplied by a soft moving band (plus a faint breathing floor so
   * the line never goes fully dark), then added to the scene.
   */
  private drawFamily(f: Family, t: number, energy: number, still: boolean) {
    const [rx, ry, rw, rh] = f.rect;
    const g = ctx2d(f.tmp);
    g.globalCompositeOperation = "copy";
    g.drawImage(f.light, 0, 0);
    g.globalCompositeOperation = "destination-in";

    const base = still ? 0.3 : 0.06 + 0.04 * Math.sin(t * 1.3 + f.phase * 6.28);
    const u = still ? 0.5 : (t / f.period + f.phase) % 1.35; // 1.35: a short rest between passes
    let mask: CanvasGradient;
    if (f.kind === "conic" && f.center) {
      const ang = still ? -0.9 : u * 6.283;
      mask = g.createConicGradient(ang, f.center[0] - rx, f.center[1] - ry);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(0.05, `rgba(0,0,0,${base + 0.35})`);
      mask.addColorStop(0.55, `rgba(0,0,0,${base})`);
      mask.addColorStop(0.8, `rgba(0,0,0,${base + 0.18})`);
      mask.addColorStop(1, "rgba(0,0,0,1)");
    } else {
      const d = f.dir ?? [1, 0];
      const cx = rw / 2;
      const cy = rh / 2;
      // extent of the rect along the direction
      const half = (Math.abs(d[0]) * rw + Math.abs(d[1]) * rh) / 2;
      const bandHalf = Math.max(30, half * 2 * f.band * 0.5);
      const pos = lerp(-half - bandHalf, half + bandHalf, clamp(u));
      const px = (s: number): [number, number] => [cx + d[0] * s, cy + d[1] * s];
      const [x0, y0] = px(pos - bandHalf);
      const [x1, y1] = px(pos + bandHalf);
      // bright head in front, long soft tail behind it
      mask = g.createLinearGradient(x1, y1, x0, y0);
      mask.addColorStop(0, `rgba(0,0,0,${base})`);
      mask.addColorStop(0.38, "rgba(0,0,0,1)");
      mask.addColorStop(0.45, "rgba(0,0,0,.85)");
      mask.addColorStop(1, `rgba(0,0,0,${base})`);
    }
    g.fillStyle = mask;
    g.fillRect(0, 0, rw, rh);

    const ctx = this.ctx;
    const born = still ? 1 : clamp((t - f.bornAt) / 0.6);
    ctx.globalAlpha = clamp(f.gain * (0.42 + 0.32 * energy), 0, 1) * born;
    ctx.drawImage(f.tmp, rx, ry);
    ctx.globalAlpha = 1;
  }

  /** Draws one frame. `t` = seconds since the splash appeared. */
  render(t: number, reduceMotion = false) {
    const plate = this.plate;
    if (!plate || !this.ready) return;
    const ctx = this.ctx;
    const { PW, PH, k } = this;
    const { w: W, h: H, logo: LOGO, bar, cx } = this.man;

    // progress eases toward the real value; a first sliver shows life before any number arrives
    const dt = Math.max(0, Math.min(0.1, t - this.lastT));
    this.lastT = t;
    const goal = Math.max(this.targetProgress, 0.03);
    this.shownProgress += (goal - this.shownProgress) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 5));
    if (this.targetProgress >= 1 && this.shownProgress > 0.985) this.shownProgress = 1;
    const prog = clamp(this.shownProgress);
    const energy = 0.55 + 0.45 * prog;
    const mt = reduceMotion ? 3.2 : t; // motion time: frozen when the user asked for less motion
    const intro = reduceMotion ? 1 : easeOut(t / 1.4);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, PW, PH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";

    const zoom = 1 + 0.03 * (1 - Math.exp(-mt / 5));
    ctx.translate(PW / 2, PH / 2);
    ctx.scale(k * zoom, k * zoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.drawImage(plate, 0, 0);

    /* ── additive light ── */
    ctx.globalCompositeOperation = "lighter";

    // 1. light families: light travels along the plate's own lines
    for (const f of this.fams) this.drawFamily(f, mt, energy * intro, reduceMotion);

    // 2. the wordmark: chrome sweep cut to the exact shape of the letters
    const sweepU = ((t - 1.1) / 2.8) % 1.8;
    if (!reduceMotion && t > 1.1 && sweepU < 1) {
      const g = ctx2d(this.tmpLogo);
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, LOGO.w, LOGO.h);
      const bx = lerp(-160, LOGO.w + 160, easeInOut(sweepU));
      g.save();
      g.transform(1, 0, -0.32, 1, 0, 0);
      const gr = g.createLinearGradient(bx - 120, 0, bx + 120, 0);
      gr.addColorStop(0, "rgba(236,228,255,0)");
      gr.addColorStop(0.5, "rgba(236,228,255,.7)");
      gr.addColorStop(1, "rgba(236,228,255,0)");
      g.fillStyle = gr;
      g.fillRect(bx - 130, -10, 260, LOGO.h + 20);
      g.restore();
      g.globalCompositeOperation = "destination-in";
      g.drawImage(this.logoMask, 0, 0);
      ctx.drawImage(this.tmpLogo, LOGO.x, LOGO.y);
    }
    this.glow(this.softGlow, cx, LOGO.y + LOGO.h * 0.55, 1080, 300, 0.07 * energy * (0.8 + 0.2 * Math.sin(mt * 1.7)) * intro);

    // 3. floor: glow that rises with loading
    this.glow(this.softGlow, cx, H - 70, 1760, 170, 0.12 * energy * (0.75 + 0.25 * Math.sin(mt * 1.4)) * intro);
    ctx.globalCompositeOperation = "source-over";

    /* ── progress bar ── */
    const bx0 = bar.x0;
    const bx1 = bar.x1;
    const by = bar.y;
    const bh = bar.h;
    ctx.beginPath();
    ctx.roundRect(bx0, by, bx1 - bx0, bh, bh / 2);
    ctx.fillStyle = "rgba(8,6,18,.94)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(196,182,255,.55)";
    ctx.stroke();

    const fw = Math.max(0, (bx1 - bx0 - 6) * prog);
    if (fw > 1) {
      ctx.globalCompositeOperation = "lighter";
      this.glow(this.softGlow, bx0 + 3 + fw / 2, by + bh / 2, fw + 70, 56, 0.34);
      ctx.globalCompositeOperation = "source-over";

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(bx0 + 3, by + 3, Math.max(fw, bh - 6), bh - 6, (bh - 6) / 2);
      const fg = ctx.createLinearGradient(bx0, 0, bx1, 0);
      fg.addColorStop(0, "#7c3aed");
      fg.addColorStop(0.6, "#b78bff");
      fg.addColorStop(1, "#ece2ff");
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.clip();
      const sh = ctx.createLinearGradient(0, by, 0, by + bh);
      sh.addColorStop(0, "rgba(255,255,255,.5)");
      sh.addColorStop(0.5, "rgba(255,255,255,0)");
      ctx.fillStyle = sh;
      ctx.fillRect(bx0, by, fw + 6, bh);
      const sx = bx0 + ((mt * 420) % (fw + 220)) - 110;
      const sgr = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0);
      sgr.addColorStop(0, "rgba(255,255,255,0)");
      sgr.addColorStop(0.5, "rgba(255,255,255,.55)");
      sgr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sgr;
      ctx.fillRect(sx - 60, by, 120, bh);
      ctx.restore();

      const hx = bx0 + 3 + fw;
      const hy = by + bh / 2;
      ctx.globalCompositeOperation = "lighter";
      this.glow(this.hotGlow, hx, hy, 66, 66, 0.9);
      this.glow(this.hotGlow, hx, hy, 130, 18, 0.35);
      ctx.globalCompositeOperation = "source-over";
    }

    /* ── localised texts (rasterised by the page) ── */
    if (this.textLayer) ctx.drawImage(this.textLayer, 0, TEXT_BAND.y0, W, TEXT_BAND.y1 - TEXT_BAND.y0);

    /* ── embers ── */
    ctx.globalCompositeOperation = "lighter";
    for (const e of this.embers) {
      const drift = reduceMotion ? 0 : t * e.v;
      const y = (e.y - drift) % (H + 40);
      const yy = y < -20 ? y + H + 40 : y;
      const x = e.x + (reduceMotion ? 0 : Math.sin(t * 0.8 + e.sw) * 14);
      const tw = 0.5 + 0.5 * Math.sin(mt * e.f * 2 + e.sw);
      this.glow(this.hotGlow, x, yy, e.s * 10, e.s * 10, e.a * (0.5 + tw * 0.5));
    }

    /* ── finishing in real pixels: cached vignette ── */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(this.getVignette(), 0, 0);
  }
}

/**
 * Cinema splash (Beta design) — canvas renderer.
 *
 * The scene is a 1916×821 (21:9) plate. Everything that moves is drawn on top
 * of it in plate coordinates, so overlays stay sharp at any resolution:
 *  - the plate's own emissive lines (ceiling, pillars, floor, outline of the
 *    play triangle…) were extracted at full resolution into "neon" layers and
 *    blurred "halo" layers, one pair per family. Light travels along each
 *    family through a soft moving band — it follows the pixels of the lines;
 *  - light is additive and always fades to 0, no rectangular outline can show;
 *  - the wordmark is lit through a mask built from its own pixels;
 *  - what is baked into the plate and must live (progress bar, tagline, label)
 *    is repainted in the plate itself, then drawn live and localised.
 * 21:9 shows the whole plate; 16:9 crops the sides; narrower screens keep at
 * least the wordmark visible.
 */

import { SPLASH_MANIFEST, splashAsset, type SplashFamily, type SplashManifest } from "./assets";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t: number) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const mk = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};
const ctx2d = (c: HTMLCanvasElement) => c.getContext("2d")!;

export interface CinemaSplashTexts {
  /** Localised signature drawn under the wordmark. */
  tagline: string;
  /** Localised loading label drawn under the bar. */
  label: string;
}

interface Family extends SplashFamily {
  neon: HTMLImageElement;
  halo: HTMLImageElement;
  tmp: HTMLCanvasElement;
  /** Scene time at which this layer finished loading (it fades in from there). */
  bornAt: number;
  period: number;
  phase: number;
  /** Length of the travelling band, as a fraction of the family's extent. */
  band: number;
  gain: number;
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

export class CinemaSplashRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private plate: HTMLImageElement | null = null;
  private readonly man: SplashManifest = SPLASH_MANIFEST;
  /** Called each time a neon layer arrives (a still scene must then be redrawn). */
  onLayerLoaded: (() => void) | null = null;
  private fams: Family[] = [];
  private ready = false;
  private texts: CinemaSplashTexts;
  private fontFamily = '"Segoe UI", system-ui, -apple-system, sans-serif';

  private PW = 1916;
  private PH = 821;
  private k = 1;
  private dpr = 1;

  private targetProgress = 0;
  private shownProgress = 0;
  private lastT = 0;

  private logoMask!: HTMLCanvasElement;
  private tmpLogo!: HTMLCanvasElement;
  private grain!: HTMLCanvasElement;
  private grainPattern: CanvasPattern | null = null;
  private embers: Ember[] = [];

  constructor(private readonly canvas: HTMLCanvasElement, texts: CinemaSplashTexts) {
    this.ctx = ctx2d(canvas);
    this.texts = texts;
  }

  setTexts(texts: CinemaSplashTexts) {
    this.texts = texts;
  }

  /** Real loading progress, 0..100. The bar eases toward it. */
  setProgress(pct: number) {
    this.targetProgress = Number.isFinite(pct) ? clamp(pct / 100) : 0;
  }

  /**
   * Resolves as soon as the plate and the wordmark mask are decoded: the scene is drawn right away.
   * The neon layers keep loading in the background and each one fades in when it arrives.
   */
  async load(): Promise<void> {
    const img = (name: string) => {
      const i = new Image();
      i.decoding = "async";
      i.src = splashAsset(name);
      return i.decode().then(() => i);
    };
    // all requests leave together; only the first two gate the first frame
    const pending = this.man.families.map((f) => Promise.all([img(`neon_${f.id}.webp`), img(`halo_${f.id}.webp`)]).then(([neon, halo]) => ({ f, neon, halo })));
    const [plate, mask] = await Promise.all([img("plate.webp"), img("logo_mask.png")]);
    this.plate = plate;
    if (typeof getComputedStyle === "function") {
      const family = getComputedStyle(document.body).fontFamily;
      if (family) this.fontFamily = family;
    }
    this.prepare(mask);
    this.ready = true;
    for (const job of pending) {
      job
        .then(({ f, neon, halo }) => {
          if (!this.plate) return;
          const r = RHYTHM[f.id] ?? { period: 4, phase: 0, band: 0.3, gain: 1 };
          this.fams.push({ ...f, neon, halo, tmp: mk(f.rect[2], f.rect[3]), bornAt: this.lastT, ...r });
          this.onLayerLoaded?.();
        })
        .catch(() => {
          /* a missing neon layer only removes that light */
        });
    }
  }

  isReady() {
    return this.ready;
  }

  /** cssW/cssH: displayed size in CSS pixels. */
  resize(cssW: number, cssH: number, devicePixelRatio: number) {
    let dpr = Math.min(devicePixelRatio || 1, 2);
    dpr = Math.min(dpr, 3840 / Math.max(cssW, 1), 2160 / Math.max(cssH, 1));
    this.dpr = dpr;
    this.PW = Math.max(2, Math.round(cssW * dpr));
    this.PH = Math.max(2, Math.round(cssH * dpr));
    this.canvas.width = this.PW;
    this.canvas.height = this.PH;
    const { w, h } = this.man;
    const aspect = this.PW / this.PH;
    // wider than the plate: fit the width (crops top/bottom); narrower: crop the sides, but keep the wordmark whole
    this.k = aspect >= w / h ? this.PW / w : this.PW / Math.max(h * aspect, 780);
  }

  dispose() {
    this.ready = false;
    this.plate = null;
  }

  /* ───────────────────────────── preparation ───────────────────────────── */

  private prepare(mask: HTMLImageElement) {
    const lg = this.man.logo;
    this.logoMask = mk(lg.w, lg.h);
    ctx2d(this.logoMask).drawImage(mask, 0, 0);
    this.tmpLogo = mk(lg.w, lg.h);

    // fine grain: breaks dark flats (banding) and softens upscaling
    this.grain = mk(256, 256);
    const gg = ctx2d(this.grain);
    const gd = gg.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = Math.random() * 255;
      gd.data[i * 4] = gd.data[i * 4 + 1] = gd.data[i * 4 + 2] = v;
      gd.data[i * 4 + 3] = 255;
    }
    gg.putImageData(gd, 0, 0);
    this.grainPattern = this.ctx.createPattern(this.grain, "repeat");

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

  /* ─────────────────────────────── drawing ─────────────────────────────── */

  /** A soft light whose alpha reaches 0 before the edge of its carrier square. */
  private glow(
    x: number,
    y: number,
    r: number,
    rx: number,
    ry: number,
    stops: [number, string][],
    alpha = 1
  ) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(rx, ry);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    for (const [o, col] of stops) g.addColorStop(o, col);
    c.globalAlpha = alpha;
    c.fillStyle = g;
    c.fillRect(-r * 1.05, -r * 1.05, r * 2.1, r * 2.1);
    c.restore();
  }

  /**
   * One neon family: its halo and its core are drawn into a private layer, then multiplied by a soft
   * moving band (plus a faint breathing floor so the line never goes fully dark) and added to the scene.
   */
  private drawFamily(f: Family, t: number, energy: number, still: boolean) {
    const [rx, ry, rw, rh] = f.rect;
    const g = ctx2d(f.tmp);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, rw, rh);
    g.globalAlpha = 0.7;
    g.drawImage(f.halo, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "lighter";
    g.drawImage(f.neon, 0, 0);
    g.globalCompositeOperation = "destination-in";

    const base = still ? 0.3 : 0.06 + 0.04 * Math.sin(t * 1.3 + f.phase * 6.28);
    const u = still ? 0.5 : (t / f.period + f.phase) % 1.35; // 1.35: a short rest between passes
    let mask: CanvasGradient;
    if (f.kind === "conic" && f.center) {
      const ang = still ? -0.9 : u * 6.283 * 1.0;
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
      const len = half * 2;
      const bandHalf = Math.max(30, len * f.band * 0.5);
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
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, PW, PH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const zoom = 1 + 0.03 * (1 - Math.exp(-mt / 5));
    ctx.save();
    ctx.translate(PW / 2, PH / 2);
    ctx.scale(k * zoom, k * zoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.drawImage(plate, 0, 0);

    /* ── additive light ── */
    ctx.globalCompositeOperation = "lighter";

    // 1. neon families: light travels along the plate's own lines
    for (const f of this.fams) this.drawFamily(f, mt, energy * intro, reduceMotion);

    // 2. the wordmark: chrome sweep cut to the exact shape of the letters
    {
      const g = ctx2d(this.tmpLogo);
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, LOGO.w, LOGO.h);
      const sweepU = ((t - 1.1) / 2.8) % 1.8;
      if (!reduceMotion && t > 1.1 && sweepU < 1) {
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
      }
      g.globalCompositeOperation = "destination-in";
      g.drawImage(this.logoMask, 0, 0);
      ctx.drawImage(this.tmpLogo, LOGO.x, LOGO.y);
    }
    this.glow(cx, LOGO.y + LOGO.h * 0.55, 300, 1.8, 0.5, [[0, "rgba(150,110,255,.07)"], [0.5, "rgba(130,90,255,.025)"], [1, "rgba(120,80,255,0)"]], (energy * (0.8 + 0.2 * Math.sin(mt * 1.7))) * intro);

    // 3. floor: glow that rises with loading
    this.glow(cx, H - 70, 420, 2.1, 0.2, [[0, "rgba(140,100,255,.12)"], [1, "rgba(120,80,255,0)"]], energy * (0.75 + 0.25 * Math.sin(mt * 1.4)) * intro);
    ctx.globalCompositeOperation = "source-over";

    /* ── progress bar ── */
    const bx0 = bar.x0;
    const bx1 = bar.x1;
    const by = bar.y;
    const bh = bar.h;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx0, by, bx1 - bx0, bh, bh / 2);
    ctx.fillStyle = "rgba(8,6,18,.94)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(196,182,255,.55)";
    ctx.stroke();
    ctx.restore();

    const fw = Math.max(0, (bx1 - bx0 - 6) * prog);
    if (fw > 1) {
      const mid = bx0 + 3 + fw / 2;
      ctx.globalCompositeOperation = "lighter";
      ctx.save();
      ctx.translate(mid, by + bh / 2);
      ctx.scale(Math.max(fw / 2 + 24, 1), 26);
      const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      hg.addColorStop(0, "rgba(150,100,255,.34)");
      hg.addColorStop(0.6, "rgba(130,90,255,.10)");
      hg.addColorStop(1, "rgba(120,80,255,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(-1.05, -1.05, 2.1, 2.1);
      ctx.restore();
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
      this.glow(hx, hy, 32, 1, 1, [[0, "rgba(240,230,255,.9)"], [0.3, "rgba(170,130,255,.45)"], [1, "rgba(130,90,255,0)"]]);
      this.glow(hx, hy, 40, 1.6, 0.22, [[0, "rgba(220,205,255,.5)"], [1, "rgba(150,110,255,0)"]], 0.6);
      ctx.globalCompositeOperation = "source-over";
    }

    /* ── localised texts (sizes keep a readable minimum on small screens) ── */
    const kCss = k / this.dpr; // CSS pixels per plate unit
    this.drawTexts(ctx, kCss);

    /* ── embers ── */
    ctx.globalCompositeOperation = "lighter";
    for (const e of this.embers) {
      const drift = reduceMotion ? 0 : t * e.v;
      const y = (e.y - drift) % (H + 40);
      const yy = y < -20 ? y + H + 40 : y;
      const x = e.x + (reduceMotion ? 0 : Math.sin(t * 0.8 + e.sw) * 14);
      const tw = 0.5 + 0.5 * Math.sin(mt * e.f * 2 + e.sw);
      this.glow(x, yy, e.s * 5, 1, 1, [[0, `rgba(${200 + tw * 40},${170 + tw * 40},255,${e.a * (0.5 + tw * 0.5)})`], [0.3, `rgba(150,110,255,${e.a * 0.35})`], [1, "rgba(120,80,255,0)"]]);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    /* ── finishing in real pixels: soft vignette, grain, intro fade ── */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // narrow screens: the plate is shorter than the screen, melt its top/bottom edge into black
    const plateH = H * k * zoom;
    if (plateH < PH - 2) {
      const m = (PH - plateH) / 2;
      for (const [y0, dir] of [[m, 1], [PH - m, -1]] as const) {
        const gr = ctx.createLinearGradient(0, y0, 0, y0 + dir * Math.min(120, plateH * 0.2));
        gr.addColorStop(0, "rgba(0,0,0,1)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(0, dir > 0 ? y0 : y0 - Math.min(120, plateH * 0.2), PW, Math.min(120, plateH * 0.2));
      }
    }
    const vg = ctx.createRadialGradient(PW / 2, PH / 2, Math.min(PW, PH) * 0.42, PW / 2, PH / 2, Math.hypot(PW, PH) * 0.56);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.4)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, PW, PH);
    if (this.grainPattern) {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = 0.12;
      ctx.translate(Math.floor(Math.random() * 256), Math.floor(Math.random() * 256));
      ctx.fillStyle = this.grainPattern;
      ctx.fillRect(-256, -256, PW + 512, PH + 512);
      ctx.restore();
    }
  }

  private drawTexts(ctx: CanvasRenderingContext2D, kCss: number) {
    const family = this.fontFamily;
    const { cx, tagY, labelY } = this.man;
    ctx.save();
    ctx.textBaseline = "middle";

    // signature under the wordmark
    const tag = this.texts.tagline.toLocaleUpperCase();
    let tagSize = Math.max(17, 11 / kCss);
    let tagSpacing = Math.max(5, tagSize * 0.4);
    ctx.textAlign = "left";
    const setTag = () => {
      ctx.font = `500 ${tagSize}px ${family}`;
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

    // loading label under the bar
    const labelSize = Math.max(17, 13 / kCss);
    ctx.font = `300 ${labelSize}px ${family}`;
    ctx.letterSpacing = "2px";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(220,216,240,.88)";
    ctx.fillText(this.texts.label, cx, labelY);
    ctx.restore();
  }
}

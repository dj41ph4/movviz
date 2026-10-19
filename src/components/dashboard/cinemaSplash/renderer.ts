/**
 * Cinema splash (Beta design) — canvas renderer.
 *
 * The scene is a 1672×941 plate (`/brand/splash-bg.webp`). Everything that
 * moves is drawn on top of it in plate coordinates, so overlays stay sharp at
 * any resolution. Three rules keep the light believable:
 *  - light is additive and always fades to 0 before the edge of what carries
 *    it — no rectangular outline can ever show;
 *  - the wordmark is lit through a mask built from its own pixels;
 *  - everything baked into the plate that must live (progress bar, floor
 *    reflection of that bar, French tagline) is repainted from healthy
 *    neighbouring rows/columns, then redrawn live and localised.
 */

const W = 1672;
const H = 941;
const EXT = 920; // sideways continuation for ultra-wide screens (up to ~32:9)
const EXTV = 520; // vertical continuation for portrait screens
const LOGO = { x: 466, y: 328, w: 746, h: 126 };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
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

type Ember = { x: number; y: number; v: number; s: number; sw: number; f: number; a: number };
type Comet = { pts: [[number, number], [number, number]]; dur: number; phase: number };

const COMETS: Comet[] = [
  { pts: [[722, 100], [1088, 294]], dur: 3.4, phase: 0 },
  { pts: [[1258, 280], [1672, 4]], dur: 4.2, phase: 0.35 },
  { pts: [[0, 584], [548, 676]], dur: 3.8, phase: 0.62 },
  { pts: [[1214, 676], [1672, 748]], dur: 3.6, phase: 0.18 },
];

export class CinemaSplashRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private img: HTMLImageElement | null = null;
  private ready = false;
  private texts: CinemaSplashTexts;
  private fontFamily = '"Segoe UI", system-ui, -apple-system, sans-serif';

  private PW = W;
  private PH = H;
  private k = 1;
  private dpr = 1;

  private targetProgress = 0;
  private shownProgress = 0;
  private lastT = 0;
  private readyAt: number | null = null;

  private left!: HTMLCanvasElement;
  private right!: HTMLCanvasElement;
  private extL!: HTMLCanvasElement;
  private extR!: HTMLCanvasElement;
  private extT!: HTMLCanvasElement;
  private extB!: HTMLCanvasElement;
  private barPatch!: HTMLCanvasElement;
  private tagPatch!: HTMLCanvasElement;
  private floorPatch!: HTMLCanvasElement;
  private logoMask!: HTMLCanvasElement;
  private bloomA!: HTMLCanvasElement;
  private bloomB!: HTMLCanvasElement;
  private tmpBloom!: HTMLCanvasElement;
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

  async load(src: string): Promise<void> {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();
    this.img = img;
    if (typeof getComputedStyle === "function") {
      const family = getComputedStyle(document.body).fontFamily;
      if (family) this.fontFamily = family;
    }
    this.prepare(img);
    this.ready = true;
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
    const aspect = this.PW / this.PH;
    let Wv = H * aspect;
    if (Wv < 800) Wv = 800; // very narrow screen: keep the whole wordmark
    this.k = this.PW / Wv;
  }

  dispose() {
    this.ready = false;
    this.img = null;
  }

  /* ───────────────────────────── preparation ───────────────────────────── */

  private prepare(img: HTMLImageElement) {
    const base = mk(W, H);
    const bg = ctx2d(base);
    bg.drawImage(img, 0, 0);
    const data = bg.getImageData(0, 0, W, H).data;

    // exact mask of the letters (luminance): light touches ONLY the letters
    this.logoMask = mk(LOGO.w, LOGO.h);
    const lm = ctx2d(this.logoMask);
    const li = lm.createImageData(LOGO.w, LOGO.h);
    for (let y = 0; y < LOGO.h; y++) {
      for (let x = 0; x < LOGO.w; x++) {
        const s = ((y + LOGO.y) * W + (x + LOGO.x)) * 4;
        const o = (y * LOGO.w + x) * 4;
        const lum = 0.299 * data[s] + 0.587 * data[s + 1] + 0.114 * data[s + 2];
        li.data[o] = li.data[o + 1] = li.data[o + 2] = 255;
        li.data[o + 3] = Math.round(255 * smooth(62, 150, lum));
      }
    }
    lm.putImageData(li, 0, 0);

    // the plate's real orange edges become live halos (half resolution, blurred)
    const half = mk(W / 2, H / 2);
    const hc = ctx2d(half);
    const hi = hc.createImageData(W / 2, H / 2);
    for (let y = 0; y < H / 2; y++) {
      for (let x = 0; x < W / 2; x++) {
        const X = x * 2;
        const Y = y * 2;
        const s = (Y * W + X) * 4;
        const o = (y * (W / 2) + x) * 4;
        const r = data[s];
        const g = data[s + 1];
        const b = data[s + 2];
        const inLogo = X > 440 && X < 1240 && Y > 318 && Y < 650; // wordmark and bar have their own lighting
        const a = inLogo ? 0 : smooth(120, 230, r) * smooth(45, 120, r - b) * smooth(30, 90, g);
        hi.data[o] = r;
        hi.data[o + 1] = g;
        hi.data[o + 2] = b;
        hi.data[o + 3] = Math.round(255 * a);
      }
    }
    hc.putImageData(hi, 0, 0);
    const blurred = (px: number) => {
      const c = mk(W / 2, H / 2);
      const g = ctx2d(c);
      g.filter = `blur(${px}px)`;
      g.drawImage(half, 0, 0);
      return c;
    };
    this.bloomA = blurred(5);
    this.bloomB = blurred(20);
    this.tmpBloom = mk(W / 2, H / 2);
    this.tmpLogo = mk(LOGO.w, LOGO.h);

    // two screen walls at different depths, feathered (no edge)
    const side = (x0: number, x1: number, a0: string, a1: string) => {
      const c = mk(W, H);
      const g = ctx2d(c);
      g.drawImage(img, 0, 0);
      const m = g.createLinearGradient(x0, 0, x1, 0);
      m.addColorStop(0, a0);
      m.addColorStop(1, a1);
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = m;
      g.fillRect(0, 0, W, H);
      return c;
    };
    this.left = side(250, 540, "#000", "rgba(0,0,0,0)");
    this.right = side(1130, 1420, "rgba(0,0,0,0)", "#000");

    // repaint what is baked into the plate: progress bar, its floor reflection, the French tagline
    this.barPatch = this.crossfadePatch(img, 410, 860, 128, 514, 642);
    this.tagPatch = this.crossfadePatch(img, 500, 675, 42, 457, 508);
    this.floorPatch = this.makeFloorPatch(img);

    this.extL = this.sideExt(img, -1);
    this.extR = this.sideExt(img, 1);
    this.extT = this.vertExt(img, -1);
    this.extB = this.vertExt(img, 1);

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

    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    this.embers = Array.from({ length: 52 }, () => ({
      x: rnd() * (W + 2 * EXT) - EXT,
      y: rnd() * H,
      v: 10 + rnd() * 28,
      s: 0.7 + rnd() * 2.1,
      sw: rnd() * 6.28,
      f: 0.5 + rnd() * 1.6,
      a: 0.25 + rnd() * 0.55,
    }));
  }

  /** Fills a band with two healthy strips (above/below) stretched and cross-faded. */
  private crossfadePatch(img: HTMLImageElement, sx: number, w: number, h: number, topSy: number, botSy: number) {
    const out = mk(w, h);
    const g = ctx2d(out);
    g.drawImage(img, sx, botSy, w, 8, 0, 0, w, h);
    const top = mk(w, h);
    const tg = ctx2d(top);
    tg.drawImage(img, sx, topSy, w, 8, 0, 0, w, h);
    tg.globalCompositeOperation = "destination-in";
    const vg = tg.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, "#000");
    vg.addColorStop(1, "rgba(0,0,0,0)");
    tg.fillStyle = vg;
    tg.fillRect(0, 0, w, h);
    g.drawImage(top, 0, 0);
    g.globalCompositeOperation = "destination-in";
    const hg = g.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, "rgba(0,0,0,0)");
    hg.addColorStop(0.035, "#000");
    hg.addColorStop(0.965, "#000");
    hg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = hg;
    g.fillRect(0, 0, w, h);
    return out;
  }

  /** The bar's reflection (x≈580-1000, from y≈735) is baked in: rebuild a clean floor from the columns on each side. */
  private makeFloorPatch(img: HTMLImageElement) {
    const FW = 560;
    const FY = 722;
    const FH = H - FY;
    const out = mk(FW, FH);
    const g = ctx2d(out);
    g.drawImage(img, 496, FY, 12, FH, 0, 0, FW, FH);
    const rightCol = mk(FW, FH);
    const rg = ctx2d(rightCol);
    rg.drawImage(img, 1074, FY, 12, FH, 0, 0, FW, FH);
    rg.globalCompositeOperation = "destination-in";
    const mx = rg.createLinearGradient(0, 0, FW, 0);
    mx.addColorStop(0, "rgba(0,0,0,0)");
    mx.addColorStop(1, "#000");
    rg.fillStyle = mx;
    rg.fillRect(0, 0, FW, FH);
    g.drawImage(rightCol, 0, 0);
    g.globalCompositeOperation = "destination-in";
    const ex = g.createLinearGradient(0, 0, FW, 0);
    ex.addColorStop(0, "rgba(0,0,0,0)");
    ex.addColorStop(0.07, "#000");
    ex.addColorStop(0.93, "#000");
    ex.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = ex;
    g.fillRect(0, 0, FW, FH);
    const ey = g.createLinearGradient(0, 0, 0, FH);
    ey.addColorStop(0, "rgba(0,0,0,0)");
    ey.addColorStop(0.12, "#000");
    ey.addColorStop(1, "#000");
    g.fillStyle = ey;
    g.fillRect(0, 0, FW, FH);
    return out;
  }

  /**
   * Blur by shrinking then enlarging. Unlike a canvas `blur()` filter it never mixes in transparent
   * pixels at the borders, so the seam with the plate stays the exact colour of the plate.
   */
  private softBlur(src: HTMLCanvasElement, factor: number) {
    const small = mk(src.width / factor, src.height / factor);
    const sg = ctx2d(small);
    sg.imageSmoothingQuality = "high";
    sg.drawImage(src, 0, 0, small.width, small.height);
    const out = mk(src.width, src.height);
    const og = ctx2d(out);
    og.imageSmoothingQuality = "high";
    og.drawImage(small, 0, 0, out.width, out.height);
    return out;
  }

  /** Mirror of the plate's edge: sharp at the seam, increasingly blurred and dark outward. */
  private sideExt(img: HTMLImageElement, dir: -1 | 1) {
    const mir = mk(EXT, H);
    const mg = ctx2d(mir);
    mg.translate(EXT, 0);
    mg.scale(-1, 1);
    if (dir < 0) mg.drawImage(img, 0, 0, EXT, H, 0, 0, EXT, H);
    else mg.drawImage(img, W - EXT, 0, EXT, H, 0, 0, EXT, H);
    const ext = mk(EXT, H);
    const eg = ctx2d(ext);
    eg.drawImage(this.softBlur(mir, 6), 0, 0);
    const sharp = mk(EXT, H);
    const sg = ctx2d(sharp);
    sg.drawImage(mir, 0, 0);
    sg.globalCompositeOperation = "destination-in";
    const a = dir < 0 ? sg.createLinearGradient(EXT, 0, EXT - 240, 0) : sg.createLinearGradient(0, 0, 240, 0);
    a.addColorStop(0, "#000");
    a.addColorStop(1, "rgba(0,0,0,0)");
    sg.fillStyle = a;
    sg.fillRect(0, 0, EXT, H);
    eg.drawImage(sharp, 0, 0);
    eg.globalCompositeOperation = "destination-in";
    const en = dir < 0 ? eg.createLinearGradient(0, 0, EXT, 0) : eg.createLinearGradient(EXT, 0, 0, 0);
    en.addColorStop(0, "rgba(0,0,0,0)");
    en.addColorStop(0.45, "rgba(0,0,0,.2)");
    en.addColorStop(0.8, "rgba(0,0,0,.65)");
    en.addColorStop(1, "#000");
    eg.fillStyle = en;
    eg.fillRect(0, 0, EXT, H);
    return ext;
  }

  /** Top/bottom continuation for portrait screens: the edge rows, stretched, blurred, fading to black. */
  private vertExt(img: HTMLImageElement, dir: -1 | 1) {
    const raw = mk(W, EXTV);
    const rg = ctx2d(raw);
    if (dir < 0) rg.drawImage(img, 0, 0, W, 6, 0, 0, W, EXTV);
    else rg.drawImage(img, 0, H - 6, W, 6, 0, 0, W, EXTV);
    const out = this.softBlur(raw, 12);
    const g = ctx2d(out);
    g.globalCompositeOperation = "destination-in";
    const m = dir < 0 ? g.createLinearGradient(0, 0, 0, EXTV) : g.createLinearGradient(0, EXTV, 0, 0);
    m.addColorStop(0, "rgba(0,0,0,0)");
    m.addColorStop(0.7, "rgba(0,0,0,.55)");
    m.addColorStop(1, "#000");
    g.fillStyle = m;
    g.fillRect(0, 0, W, EXTV);
    return out;
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

  /** Draws one frame. `t` = seconds since the splash appeared. */
  render(t: number, reduceMotion = false) {
    const img = this.img;
    if (!img || !this.ready) return;
    const ctx = this.ctx;
    const { PW, PH, k } = this;

    // progress eases toward the real value; a first sliver shows life before any number arrives
    const dt = Math.max(0, Math.min(0.1, t - this.lastT));
    this.lastT = t;
    const goal = Math.max(this.targetProgress, 0.03);
    this.shownProgress += (goal - this.shownProgress) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 5));
    if (this.targetProgress >= 1 && this.shownProgress > 0.985) this.shownProgress = 1;
    const prog = clamp(this.shownProgress);
    if (prog >= 1 && this.readyAt === null) this.readyAt = t;
    const flash = this.readyAt !== null && !reduceMotion ? clamp(1 - (t - this.readyAt) / 1.1) : 0;
    const fade = reduceMotion ? 0 : t < 0.9 ? 1 - easeOut(t / 0.9) : 0;
    const energy = 0.55 + 0.45 * prog;
    const mt = reduceMotion ? 3.2 : t; // motion time: frozen when the user asked for less motion

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, PW, PH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const zoom = 1 + 0.035 * (1 - Math.exp(-mt / 5));
    ctx.save();
    ctx.translate(PW / 2, PH / 2);
    ctx.scale(k * zoom, k * zoom);
    ctx.translate(-W / 2, -H / 2);

    ctx.drawImage(this.extL, -EXT, 0);
    ctx.drawImage(this.extR, W, 0);
    ctx.drawImage(this.extT, 0, -EXTV);
    ctx.drawImage(this.extB, 0, H);
    ctx.drawImage(img, 0, 0);
    const ox = Math.sin(mt * 0.85) * 3.5;
    const oy = Math.cos(mt * 0.6) * 1.6;
    ctx.drawImage(this.left, ox, oy);
    ctx.drawImage(this.right, -ox, -oy);
    ctx.drawImage(this.barPatch, 410, 520);
    ctx.drawImage(this.tagPatch, 500, 466);
    ctx.drawImage(this.floorPatch, 510, 722);

    /* ── additive light ── */
    ctx.globalCompositeOperation = "lighter";

    // 1. live halos on the plate's real orange edges, with a travelling wave
    const wave = (mt * 0.32) % 1.4;
    for (const [src, amt] of [[this.bloomB, 0.85], [this.bloomA, 0.55]] as const) {
      const g = ctx2d(this.tmpBloom);
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, W / 2, H / 2);
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = "destination-in";
      const cx = lerp(-200, W / 2 + 200, wave / 1.4);
      const m = g.createLinearGradient(cx - 380, 0, cx + 380, 0);
      m.addColorStop(0, "rgba(0,0,0,.35)");
      m.addColorStop(0.5, "#000");
      m.addColorStop(1, "rgba(0,0,0,.35)");
      g.fillStyle = m;
      g.fillRect(0, 0, W / 2, H / 2);
      ctx.globalAlpha = amt * energy * (0.7 + 0.3 * Math.sin(mt * 2.1));
      ctx.drawImage(this.tmpBloom, 0, 0, W, H);
    }
    ctx.globalAlpha = 1;

    // 2. comets: tapered tail + hot core + short flare
    if (!reduceMotion) {
      for (const P of COMETS) {
        const cyc = (t / P.dur + P.phase) % 1.7;
        if (cyc > 1) continue;
        const at = (u: number): [number, number] => [lerp(P.pts[0][0], P.pts[1][0], u), lerp(P.pts[0][1], P.pts[1][1], u)];
        const head = at(cyc);
        const tailU = Math.max(0, cyc - 0.26);
        const steps = 22;
        ctx.lineCap = "round";
        for (let i = 0; i < steps; i++) {
          const a0 = at(lerp(tailU, cyc, i / steps));
          const a1 = at(lerp(tailU, cyc, (i + 1) / steps));
          const kk = (i + 1) / steps;
          ctx.beginPath();
          ctx.moveTo(a0[0], a0[1]);
          ctx.lineTo(a1[0], a1[1]);
          ctx.strokeStyle = `rgba(255,${150 + 90 * kk},${60 + 110 * kk * kk},${0.05 + 0.8 * kk * kk})`;
          ctx.lineWidth = 0.7 + 3.4 * kk * kk;
          ctx.stroke();
        }
        this.glow(head[0], head[1], 30, 1, 1, [[0, "rgba(255,240,205,.9)"], [0.2, "rgba(255,190,90,.45)"], [1, "rgba(255,140,30,0)"]]);
        this.glow(head[0], head[1], 34, 1.7, 0.2, [[0, "rgba(255,226,170,.6)"], [1, "rgba(255,160,50,0)"]], 0.5);
      }
    }

    // 3. the wordmark: light cut to the exact shape of the letters
    {
      const g = ctx2d(this.tmpLogo);
      g.globalCompositeOperation = "source-over";
      g.clearRect(0, 0, LOGO.w, LOGO.h);
      const sweepU = ((t - 1.1) / 2.6) % 1.8;
      if (!reduceMotion && t > 1.1 && sweepU < 1) {
        const bx = lerp(-160, LOGO.w + 160, easeInOut(sweepU));
        g.save();
        g.transform(1, 0, -0.32, 1, 0, 0);
        const gr = g.createLinearGradient(bx - 120, 0, bx + 120, 0);
        gr.addColorStop(0, "rgba(255,246,225,0)");
        gr.addColorStop(0.5, "rgba(255,246,225,.95)");
        gr.addColorStop(1, "rgba(255,246,225,0)");
        g.fillStyle = gr;
        g.fillRect(bx - 130, -10, 260, LOGO.h + 20);
        g.restore();
      }
      if (flash > 0) {
        g.fillStyle = `rgba(255,226,170,${flash * 0.85})`;
        g.fillRect(0, 0, LOGO.w, LOGO.h);
      }
      g.globalCompositeOperation = "destination-in";
      g.drawImage(this.logoMask, 0, 0);
      ctx.drawImage(this.tmpLogo, LOGO.x, LOGO.y);
    }
    this.glow(838, 392, 240, 1.7, 0.55, [[0, "rgba(255,170,60,.12)"], [0.5, "rgba(255,150,40,.04)"], [1, "rgba(255,140,30,0)"]], energy * (0.8 + 0.2 * Math.sin(mt * 1.7)) + flash * 0.8);

    // 4. rings from the play button
    if (!reduceMotion) {
      for (let i = 0; i < 2; i++) {
        const r = (t / 2.7 + i * 0.5) % 1;
        ctx.beginPath();
        ctx.arc(705, 386, 72 + 78 * easeOut(r), 0, 6.283);
        ctx.strokeStyle = `rgba(255,172,55,${Math.pow(1 - r, 2) * 0.55})`;
        ctx.lineWidth = 3.2 * (1 - r) + 0.5;
        ctx.stroke();
      }
    }
    this.glow(705, 386, 96, 1, 1, [[0, "rgba(255,170,60,0)"], [0.7, "rgba(255,170,60,.10)"], [1, "rgba(255,170,60,0)"]], 0.6 + 0.4 * Math.sin(mt * 2.3));

    // 5. floor: glow that rises with loading + a gliding specular
    this.glow(838, 745, 230, 1.9, 0.2, [[0, "rgba(255,170,70,.14)"], [1, "rgba(255,150,40,0)"]], energy * (0.75 + 0.25 * Math.sin(mt * 1.4)));
    if (!reduceMotion) {
      const spec = ((t - 0.6) / 3.4) % 1.5;
      if (t > 0.6 && spec < 1) {
        this.glow(lerp(260, 1420, easeInOut(spec)), 738, 56, 2.4, 0.08, [[0, "rgba(255,225,170,.4)"], [1, "rgba(255,170,60,0)"]], Math.sin(spec * Math.PI));
      }
    }
    ctx.globalCompositeOperation = "source-over";

    /* ── progress bar ── */
    const bx0 = 466;
    const bx1 = 1207;
    const by = 553;
    const bh = 24;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx0, by, bx1 - bx0, bh, bh / 2);
    ctx.fillStyle = "rgba(9,13,30,.92)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(172,184,216,.5)";
    ctx.stroke();
    ctx.restore();

    const fw = Math.max(0, (bx1 - bx0 - 6) * prog);
    ctx.globalCompositeOperation = "lighter";
    if (fw > 1) {
      const mid = bx0 + 3 + fw / 2;
      ctx.save();
      ctx.translate(mid, by + bh / 2);
      ctx.scale(Math.max(fw / 2 + 24, 1), 24);
      const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      hg.addColorStop(0, "rgba(255,160,40,.34)");
      hg.addColorStop(0.6, "rgba(255,150,30,.10)");
      hg.addColorStop(1, "rgba(255,140,20,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(-1.05, -1.05, 2.1, 2.1);
      ctx.restore();
      // live floor reflection of the filled part
      ctx.save();
      ctx.translate(mid, 790);
      ctx.scale(Math.max(fw / 2 + 24, 1), 62);
      const rf = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      rf.addColorStop(0, `rgba(255,168,70,${0.3 + flash * 0.25})`);
      rf.addColorStop(0.55, "rgba(255,150,50,.10)");
      rf.addColorStop(1, "rgba(255,140,40,0)");
      ctx.fillStyle = rf;
      ctx.fillRect(-1.05, -1.05, 2.1, 2.1);
      ctx.restore();
    }
    ctx.globalCompositeOperation = "source-over";
    if (fw > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(bx0 + 3, by + 3, Math.max(fw, bh - 6), bh - 6, (bh - 6) / 2);
      const fg = ctx.createLinearGradient(bx0, 0, bx1, 0);
      fg.addColorStop(0, "#ffd27a");
      fg.addColorStop(0.55, "#ffa62b");
      fg.addColorStop(1, "#ff8a14");
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.clip();
      const sh = ctx.createLinearGradient(0, by, 0, by + bh);
      sh.addColorStop(0, "rgba(255,255,255,.55)");
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
      this.glow(hx, hy, 32 + flash * 22, 1, 1, [[0, "rgba(255,240,200,.9)"], [0.3, "rgba(255,175,55,.45)"], [1, "rgba(255,150,30,0)"]]);
      this.glow(hx, hy, 40, 1.6, 0.22, [[0, "rgba(255,226,170,.5)"], [1, "rgba(255,160,50,0)"]], 0.6);
      ctx.globalCompositeOperation = "source-over";
    }
    if (flash > 0) {
      ctx.globalCompositeOperation = "lighter";
      this.glow(837, by + bh / 2, 240, 1.2, 0.045, [[0, `rgba(255,214,140,${0.5 * flash})`], [0.4, `rgba(255,170,60,${0.2 * flash})`], [1, "rgba(255,150,30,0)"]]);
      this.glow(837, by + bh / 2, 120, 1.3, 0.5, [[0, `rgba(255,200,110,${0.16 * flash})`], [1, "rgba(255,150,30,0)"]]);
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
      this.glow(x, yy, e.s * 5, 1, 1, [[0, `rgba(255,${190 + tw * 40},110,${e.a * (0.5 + tw * 0.5)})`], [0.3, `rgba(255,160,60,${e.a * 0.35})`], [1, "rgba(255,140,30,0)"]]);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    /* ── finishing in real pixels: soft vignette, grain, intro fade ── */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const vg = ctx.createRadialGradient(PW / 2, PH / 2, Math.min(PW, PH) * 0.42, PW / 2, PH / 2, Math.hypot(PW, PH) * 0.56);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.42)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, PW, PH);
    if (this.grainPattern) {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = 0.13;
      ctx.translate(Math.floor(Math.random() * 256), Math.floor(Math.random() * 256));
      ctx.fillStyle = this.grainPattern;
      ctx.fillRect(-256, -256, PW + 512, PH + 512);
      ctx.restore();
    }
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, PW, PH);
    }
  }

  private drawTexts(ctx: CanvasRenderingContext2D, kCss: number) {
    const family = this.fontFamily;
    ctx.save();
    ctx.textBaseline = "middle";

    // signature under the wordmark: spans at most ~86% of the wordmark width
    const tag = this.texts.tagline.toLocaleUpperCase();
    let tagSize = Math.max(17, 11 / kCss);
    let tagSpacing = Math.max(5, tagSize * 0.44);
    ctx.textAlign = "left";
    const setTag = () => {
      ctx.font = `500 ${tagSize}px ${family}`;
      ctx.letterSpacing = `${tagSpacing}px`;
    };
    setTag();
    let tagW = ctx.measureText(tag).width;
    const maxTag = 640;
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
    const tx = 837 - tagW / 2;
    const tg = ctx.createLinearGradient(tx, 0, tx + tagW, 0);
    tg.addColorStop(0, "#aab4d6");
    tg.addColorStop(0.62, "#aab4d6");
    tg.addColorStop(0.78, "#ffb33d");
    tg.addColorStop(1, "#f58a14");
    ctx.fillStyle = tg;
    ctx.fillText(tag, tx, 486);

    // loading label under the bar
    const labelSize = Math.max(17, 13 / kCss);
    ctx.font = `300 ${labelSize}px ${family}`;
    ctx.letterSpacing = "2px";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(208,214,236,.86)";
    ctx.fillText(this.texts.label, 837, 606);
    ctx.restore();
  }
}

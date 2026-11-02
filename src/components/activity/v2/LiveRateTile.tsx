"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatSpeed } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { useLiveRate } from "@/lib/downloads/liveRate";

const POINTS = 60;
const W = 300;
const H = 90;
const TOP = 8;
const BOTTOM = H - 4;
const STEP = W / (POINTS - 1);
/** Échelle minimale (octets/s) : un débit de 5 KB/s ne doit pas ressembler à un pic. */
const MIN_SCALE = 128 * 1024;

/** Valeur qui glisse vers sa cible (≈450 ms) : un seul rAF actif pendant la
 *  transition, rien entre deux échantillons. */
function useTweened(target: number, reduce: boolean, ms = 450): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduce) return;
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const current = origin + (target - origin) * eased;
      from.current = current;
      setValue(current);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduce, ms]);
  return reduce ? target : value;
}

/** Courbe lissée (Catmull-Rom → Bézier) : pas d'angles, pas de « ruban » épais. */
function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = Math.min(BOTTOM, Math.max(TOP, p1[1] + (p2[1] - p0[1]) / 6));
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = Math.min(BOTTOM, Math.max(TOP, p2[1] - (p3[1] - p1[1]) / 6));
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function toXY(values: number[], max: number): [number, number][] {
  const offset = (POINTS - values.length) * STEP;
  return values.map((v, i) => [offset + i * STEP, BOTTOM - Math.min(1, v / max) * (BOTTOM - TOP)]);
}

/**
 * Débit en direct, 2 mises à jour par seconde tant que ça transfère (1 toutes
 * les 4 s au repos) : un seul sondage partagé par toute l'app (`useLiveRate`).
 * Le graphe glisse en continu par une animation CSS sur un seul groupe SVG
 * (pas de redessin par image), la courbe est lissée, la tête de courbe pulse.
 */
export function LiveRateTile() {
  const t = useT();
  const reduce = useShouldReduceMotion();
  const live = useLiveRate();
  const groupRef = useRef<SVGGElement>(null);
  const lastAt = useRef(0);
  const samples = live.downs.length;

  // Glissement synchronisé sur le rythme réel des échantillons.
  useEffect(() => {
    const node = groupRef.current;
    const now = performance.now();
    const interval = lastAt.current ? Math.min(4000, Math.max(300, now - lastAt.current)) : 500;
    lastAt.current = now;
    if (!node || reduce || samples < 2 || typeof node.animate !== "function") return;
    const slide = node.animate(
      [{ transform: `translateX(${STEP}px)` }, { transform: "translateX(0)" }],
      { duration: interval, easing: "linear" },
    );
    return () => slide.cancel();
  }, [live, reduce, samples]);

  const peak = Math.max(MIN_SCALE, ...live.downs, ...live.ups) * 1.12;
  const downXY = toXY(live.downs, peak);
  const upXY = toXY(live.ups, peak);
  const downPath = smoothPath(downXY);
  const upPath = smoothPath(upXY);
  const head = downXY.at(-1);
  const area = downPath && head ? `${downPath} L${head[0].toFixed(1)},${H} L${downXY[0][0].toFixed(1)},${H} Z` : "";
  const shownDown = useTweened(live.down, reduce);
  const shownUp = useTweened(live.up, reduce);

  return (
    <div className="nx-dlq-tile relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-br from-white/[.07] to-white/[.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_20px_40px_-24px_#000] sm:p-5">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] w-full overflow-visible">
        <defs>
          <linearGradient id="nxDlqArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--color-brand-glow)" stopOpacity=".38" />
            <stop offset="1" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="nxDlqLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0" />
            <stop offset=".35" stopColor="var(--color-brand)" />
            <stop offset="1" stopColor="var(--color-brand-glow)" />
          </linearGradient>
        </defs>
        {[0.33, 0.66].map((k) => (
          <line key={k} x1="0" x2={W} y1={TOP + (BOTTOM - TOP) * k} y2={TOP + (BOTTOM - TOP) * k} stroke="rgba(255,255,255,.06)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        ))}
        <g ref={groupRef}>
          {area && <path d={area} fill="url(#nxDlqArea)" />}
          {upPath && <path d={upPath} fill="none" stroke="var(--color-cyan)" strokeOpacity=".65" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          {downPath && <path d={downPath} fill="none" stroke="url(#nxDlqLine)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 6px rgba(139,123,255,.75))" }} />}
        </g>
      </svg>
      {head && (
        // Tête de courbe : suit le dernier point, le graphe glisse derrière elle.
        <span
          aria-hidden
          className="pointer-events-none absolute flex h-3 w-3 -translate-x-1/2 translate-y-1/2 items-center justify-center transition-[bottom,left] duration-500 ease-linear"
          style={{ left: `${(head[0] / W) * 100}%`, bottom: `calc(72% * ${(H - head[1]) / H})` }}
        >
          <span className={`absolute h-3 w-3 rounded-full bg-brand-glow/50 ${reduce ? "" : "animate-ping"}`} />
          <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_var(--color-brand-glow)]" />
        </span>
      )}
      <p className="relative text-[10.5px] font-bold uppercase tracking-[.08em] text-ink-dim">{t("downloads.liveRate")}</p>
      <div className="relative mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <p className="flex items-baseline gap-2">
          <ArrowDown aria-hidden className="h-4 w-4 self-center text-brand-glow" />
          <span className="text-2xl font-extrabold tabular-nums tracking-tight text-ink sm:text-3xl">{formatSpeed(Math.max(0, Math.round(shownDown)))}</span>
        </p>
        <p className="flex items-baseline gap-1.5 text-ink-soft">
          <ArrowUp aria-hidden className="h-3.5 w-3.5 self-center text-cyan" />
          <span className="text-base font-bold tabular-nums">{formatSpeed(Math.max(0, Math.round(shownUp)))}</span>
        </p>
      </div>
      <div className="relative h-12 sm:h-14" />
    </div>
  );
}

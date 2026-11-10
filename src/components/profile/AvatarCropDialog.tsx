"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import {
  AVATAR_MAX_ZOOM, AVATAR_MIN_ZOOM, AVATAR_OUTPUT_PX,
  centeredOffset, clampOffset, clampZoom, sourceRect, zoomAroundCenter,
} from "@/lib/avatarCrop";

/** Décode l'image en tenant compte de l'orientation EXIF (photos de téléphone). */
async function decode(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

/**
 * Recadrage de la photo de profil : glisser pour déplacer, molette / curseur / pincement pour zoomer.
 * Cadre circulaire comme l'affichage final ; l'image envoyée est un carré 512×512.
 */
export function AvatarCropDialog({ file, onCancel, onConfirm }: {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const t = useT();
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewport, setViewport] = useState(280);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const applyRef = useRef<HTMLButtonElement>(null);

  // Cadre adapté à l'écran (375 px de large : 280 px de cadre au plus, marges comprises).
  useEffect(() => {
    const fit = () => setViewport(Math.max(200, Math.min(300, window.innerWidth - 80)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    let alive = true;
    let opened: ImageBitmap | null = null;
    decode(file).then((b) => {
      if (!alive) { b?.close(); return; }
      if (!b) { setFailed(true); return; }
      opened = b;
      setBitmap(b);
      setZoom(1);
    });
    return () => { alive = false; opened?.close(); };
  }, [file]);

  // Recentre quand l'image ou la taille du cadre change.
  useEffect(() => {
    if (bitmap) setOffset(centeredOffset(bitmap.width, bitmap.height, viewport, 1));
    setZoom(1);
  }, [bitmap, viewport]);

  const iw = bitmap?.width ?? 1;
  const ih = bitmap?.height ?? 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewport * ratio);
    canvas.height = Math.round(viewport * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const r = sourceRect(iw, ih, viewport, zoom, offset.x, offset.y);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height);
  }, [bitmap, viewport, zoom, offset, iw, ih]);

  const setZoomKeepingCenter = useCallback((next: number) => {
    if (!bitmap) return;
    const z = clampZoom(next);
    setOffset((o) => zoomAroundCenter(iw, ih, viewport, zoom, z, o.x, o.y));
    setZoom(z);
  }, [bitmap, iw, ih, viewport, zoom]);

  // Molette : listener natif non passif (React attache les siens en passif).
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomKeepingCenter(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [setZoomKeepingCenter, zoom]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.dist > 0) setZoomKeepingCenter(pinch.current.zoom * (dist / pinch.current.dist));
      return;
    }
    const d = drag.current;
    if (!d) return;
    setOffset(clampOffset(iw, ih, viewport, zoom, d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    const rest = [...pointers.current.values()][0];
    drag.current = rest ? { x: rest.x, y: rest.y, ox: offset.x, oy: offset.y } : null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onCancel(); return; }
    if (!bitmap) return;
    const step = 12;
    const move = (dx: number, dy: number) => { e.preventDefault(); setOffset((o) => clampOffset(iw, ih, viewport, zoom, o.x + dx, o.y + dy)); };
    if (e.key === "ArrowLeft") move(step, 0);
    else if (e.key === "ArrowRight") move(-step, 0);
    else if (e.key === "ArrowUp") move(0, step);
    else if (e.key === "ArrowDown") move(0, -step);
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoomKeepingCenter(zoom * 1.1); }
    else if (e.key === "-") { e.preventDefault(); setZoomKeepingCenter(zoom / 1.1); }
  };

  useEffect(() => { if (bitmap) applyRef.current?.focus(); }, [bitmap]);

  const [saving, setSaving] = useState(false);
  const apply = async () => {
    if (!bitmap || saving) return;
    setSaving(true);
    try {
      const out = document.createElement("canvas");
      out.width = AVATAR_OUTPUT_PX;
      out.height = AVATAR_OUTPUT_PX;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      const r = sourceRect(iw, ih, viewport, zoom, offset.x, offset.y);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, 0, 0, AVATAR_OUTPUT_PX, AVATAR_OUTPUT_PX);
      const blob: Blob | null = await new Promise((resolve) =>
        out.toBlob((b) => (b && b.type === "image/webp" ? resolve(b) : out.toBlob(resolve, "image/jpeg", 0.92)), "image/webp", 0.92));
      if (blob) onConfirm(blob);
    } finally {
      setSaving(false);
    }
  };

  const sliderValue = useMemo(() => Math.round(((zoom - AVATAR_MIN_ZOOM) / (AVATAR_MAX_ZOOM - AVATAR_MIN_ZOOM)) * 100), [zoom]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={t("profile.cropTitle")} className="glass-strong relative w-full max-w-[380px] rounded-2xl p-5 shadow-2xl">
        <h3 className="text-base font-bold text-ink">{t("profile.cropTitle")}</h3>
        <p className="mb-4 mt-1 text-[13px] leading-5 text-ink-dim">{t("profile.cropHint")}</p>

        <div className="flex justify-center">
          {failed ? (
            <div className="flex items-center justify-center text-sm text-ink-dim" style={{ width: viewport, height: viewport }}>{t("profile.cropUnreadable")}</div>
          ) : !bitmap ? (
            <div className="flex items-center justify-center" style={{ width: viewport, height: viewport }}>
              <Loader2 className="h-6 w-6 animate-spin text-ink-dim" />
            </div>
          ) : (
            <div
              ref={frameRef}
              tabIndex={0}
              role="img"
              aria-label={t("profile.cropTitle")}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="cursor-grab touch-none select-none overflow-hidden rounded-full ring-2 ring-white/50 active:cursor-grabbing"
              style={{ width: viewport, height: viewport }}
            >
              <canvas ref={canvasRef} style={{ width: viewport, height: viewport, display: "block" }} />
            </div>
          )}
        </div>

        {bitmap && (
          <label className="mt-4 flex items-center gap-3 text-[13px] text-ink-dim">
            <span className="shrink-0">{t("profile.cropZoom")}</span>
            <input
              type="range" min={0} max={100} value={sliderValue}
              onChange={(e) => setZoomKeepingCenter(AVATAR_MIN_ZOOM + (Number(e.target.value) / 100) * (AVATAR_MAX_ZOOM - AVATAR_MIN_ZOOM))}
              className="h-11 w-full accent-[var(--accent,#8b5cf6)]"
            />
          </label>
        )}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex h-11 flex-1 items-center justify-center rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft">
            {t("profile.cropCancel")}
          </button>
          <button
            ref={applyRef} type="button" onClick={apply} disabled={!bitmap || saving}
            className="flex h-11 flex-1 items-center justify-center rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("profile.cropApply")}
          </button>
        </div>
      </div>
    </div>
  );
}

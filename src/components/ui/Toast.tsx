"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGpu } from "@/lib/gpu/GpuProvider";

type ToastType = "success" | "error" | "info" | "grab";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let nextId = 1;
let addToastFn: ((type: ToastType, message: string) => void) | null = null;

export function toast(type: ToastType, message: string) {
  addToastFn?.(type, message);
}

export function ToastContainer() {
  const gpu = useGpu();
  const reduceAnimations = gpu.reduceAnimations;

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <>
      {/* Desktop: premium card at bottom-right */}
      <div className="fixed bottom-6 right-6 z-[200] hidden flex-col gap-2 sm:flex" style={{ maxWidth: "min(360px, calc(100vw - 2rem))" }}>
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastCard key={t.id} t={t} dismiss={dismiss} reduceAnimations={reduceAnimations} />
          ))}
        </AnimatePresence>
      </div>

      {/* Mobile: thin line at bottom center, 1s */}
      <div className="fixed bottom-0 left-0 right-0 z-[200] flex items-end justify-center pb-8 sm:hidden">
        <AnimatePresence>
          {toasts.map((t) => (
            <MobileToast key={t.id} t={t} reduceAnimations={reduceAnimations} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function ToastCard({ t, dismiss, reduceAnimations }: { t: ToastItem; dismiss: (id: number) => void; reduceAnimations: boolean }) {
  const isGrab = t.type === "grab";

  if (isGrab) {
    return (
      <motion.div
        initial={reduceAnimations ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceAnimations ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.9 }}
        transition={reduceAnimations ? { duration: 0.12 } : { type: "spring", stiffness: 350, damping: 24, mass: 0.8 }}
        className="group relative overflow-hidden rounded-2xl border border-white/10"
        style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(30,18,50,0.95) 50%, rgba(30,18,50,0.98) 100%)" }}
      >
        {/* Shimmer (GPU-composited via transform) */}
        <div className="shimmer-gpu absolute inset-0" />
        <div className="relative flex items-start gap-3 px-4 py-3.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/25 backdrop-blur">
            <Download className="h-4 w-4 text-brand-glow" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white">Ajouté aux téléchargements</p>
            <p className="mt-0.5 truncate text-[11px] leading-tight text-white/60">{t.message}</p>
          </div>
          <button onClick={() => dismiss(t.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-40 transition-opacity hover:opacity-80">
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      </motion.div>
    );
  }

  const colors: Record<string, string> = {
    success: "border-ok/30 bg-ok/12 text-ok",
    error: "border-down/30 bg-down/12 text-down",
    info: "border-brand/30 bg-brand/12 text-brand-glow",
  };
  const icons: Record<string, React.ReactNode> = {
    success: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>,
    error: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6" /></svg>,
    info: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01" /></svg>,
  };

  return (
    <motion.div
      initial={reduceAnimations ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceAnimations ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }}
      transition={reduceAnimations ? { duration: 0.12 } : { type: "spring", stiffness: 400, damping: 28 }}
      className={cn("flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold shadow-lg backdrop-blur-xl", colors[t.type])}
    >
      {icons[t.type]}
      <span className="flex-1 leading-tight">{t.message}</span>
      <button onClick={() => dismiss(t.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-50 transition-opacity hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

function MobileToast({ t, reduceAnimations }: { t: ToastItem; reduceAnimations: boolean }) {
  const colors: Record<string, string> = {
    success: "bg-ok", error: "bg-down", info: "bg-brand-glow", grab: "bg-brand-glow",
  };
  return (
    <motion.div
      initial={reduceAnimations ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="w-[calc(100vw-2rem)] max-w-sm rounded-xl px-4 py-2.5 backdrop-blur-xl"
      style={{ background: "linear-gradient(180deg, rgba(30,18,50,0.98) 0%, rgba(20,10,40,0.95) 100%)" }}
    >
      <p className="text-center text-[13px] font-semibold leading-tight text-white">{t.message}</p>
      <div className={cn("mx-auto mt-1.5 h-0.5 rounded-full", colors[t.type])} style={{ width: "min(60px, 30%)" }} />
    </motion.div>
  );
}

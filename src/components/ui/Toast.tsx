"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGpu } from "@/lib/gpu/GpuProvider";

type ToastType = "success" | "error" | "info";

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

  const icon = {
    success: <CheckCircle className="h-4 w-4" />,
    error: <AlertTriangle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />,
  };

  const bg = {
    success: "border-ok/30 bg-ok/12 text-ok",
    error: "border-down/30 bg-down/12 text-down",
    info: "border-brand/30 bg-brand/12 text-brand-glow",
  };

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2" style={{ maxWidth: "calc(100vw - 2rem)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={reduceAnimations ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceAnimations ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.95 }}
            transition={reduceAnimations ? { duration: 0.15 } : { type: "spring", stiffness: 400, damping: 28 }}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur-md",
              bg[t.type]
            )}
          >
            {icon[t.type]}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="flex h-11 w-11 shrink-0 items-center justify-center opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

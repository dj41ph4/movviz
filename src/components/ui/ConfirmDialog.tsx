"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGpu } from "@/lib/gpu/GpuProvider";
import { useT } from "@/i18n/provider";

interface ConfirmOptions {
  /** "danger" (red, for destructive actions) or "default" (brand purple). Defaults to "danger". */
  tone?: "danger" | "default";
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmState extends ConfirmOptions {
  id: number;
  message: string;
  resolve: (value: boolean) => void;
}

let nextId = 1;
let requestFn: ((message: string, options?: ConfirmOptions) => Promise<boolean>) | null = null;

/** Drop-in, promise-based replacement for window.confirm() — resolves true/false. */
export function confirmDialog(message: string, options?: ConfirmOptions): Promise<boolean> {
  if (!requestFn) return Promise.resolve(false);
  return requestFn(message, options);
}

export function ConfirmDialogHost() {
  const gpu = useGpu();
  const reduceAnimations = gpu.reduceAnimations;
  const t = useT();
  const [state, setState] = useState<ConfirmState | null>(null);

  const request = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ id: nextId++, message, resolve, ...options });
    });
  }, []);

  useEffect(() => {
    requestFn = request;
    return () => { requestFn = null; };
  }, [request]);

  const settle = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const danger = (state?.tone ?? "danger") === "danger";

  return (
    <AnimatePresence>
      {state && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => settle(false)}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            initial={reduceAnimations ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceAnimations ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            transition={reduceAnimations ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 30 }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl glass-stronger p-5 shadow-2xl sm:p-6"
          >
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full blur-3xl",
                danger ? "bg-down/25" : "bg-brand/25"
              )}
            />
            <div className="relative flex flex-col items-center text-center">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border",
                  danger ? "border-down/30 bg-down/12 text-down" : "border-brand/30 bg-brand/12 text-brand-glow"
                )}
              >
                {danger ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
              </div>
              <p className="mt-4 text-sm font-semibold leading-relaxed text-ink">{state.message}</p>
              <div className="mt-6 flex w-full gap-2">
                <button
                  onClick={() => settle(false)}
                  className="h-11 flex-1 rounded-xl glass text-sm font-bold text-ink-soft transition hover:bg-white/10"
                >
                  {state.cancelLabel ?? t("common.cancel")}
                </button>
                <button
                  onClick={() => settle(true)}
                  autoFocus
                  className={cn(
                    "h-11 flex-1 rounded-xl text-sm font-bold text-white shadow-lg transition hover:scale-105",
                    danger ? "bg-gradient-to-r from-down to-[#f43f5e]" : "brand-gradient"
                  )}
                >
                  {state.confirmLabel ?? t("common.confirm")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

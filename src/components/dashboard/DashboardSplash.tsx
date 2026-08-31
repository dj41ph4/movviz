"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AnimatedLogo } from "@/components/fx/AnimatedLogo";

export function DashboardSplash({ show, progress }: { show: boolean; progress?: number }) {
  const pct = Math.max(0, Math.min(100, progress ?? 0));
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-[#08080F] px-6"
          aria-hidden
        >
          {/* Fond Movviz haute qualité : void profond + halos brand/magenta/cyan comme TV */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(124,58,237,0.22),transparent_36%),radial-gradient(circle_at_88%_78%,rgba(92,224,216,0.14),transparent_34%),radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.08),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/20" />
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="relative flex flex-col items-center gap-7"
          >
            <div className="relative">
              <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-brand/10 blur-2xl" />
              <AnimatedLogo size="lg" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <p className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-[13px] font-black tracking-[0.24em] text-transparent">MOVVIZ</p>
              <p className="text-[11px] font-semibold tracking-wide text-white/45">Préparation de ton cinéma…</p>
            </div>
            {/* Barre intelligente Movviz : brand → magenta → cyan, shimmer */}
            <div className="mt-2 h-1.5 w-[min(280px,72vw)] overflow-hidden rounded-full bg-white/10 p-0.5 backdrop-blur">
              <motion.div
                className="h-full rounded-full brand-gradient relative overflow-hidden"
                initial={{ width: "8%" }}
                animate={{ width: `${Math.max(12, pct)}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/22 to-transparent opacity-60" style={{ animation: "shimmer 1.2s ease-in-out infinite" }} />
              </motion.div>
            </div>
            <p className="text-[10px] font-bold tabular-nums tracking-widest text-white/35">{Math.round(pct)}%</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

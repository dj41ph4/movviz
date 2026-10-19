"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDesignMode } from "@/components/appearance/AppearanceProvider";
import { CinemaSplashCanvas } from "./CinemaSplashCanvas";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { useT } from "@/i18n/provider";
import "./dashboard-splash.css";

const clearPresplash = () => document.documentElement.removeAttribute("data-mv-presplash");

export function DashboardSplash({ show, progress }: { show: boolean; progress?: number }) {
  const { mode } = useDesignMode();
  const reduceMotion = useShouldReduceMotion();
  const t = useT();
  const beta = mode === "beta";
  // Le décor posé avant l'hydratation doit disparaître même si le splash ne s'affiche pas (déjà vu, mode sans splash).
  useEffect(() => {
    if (show) return;
    const id = window.setTimeout(clearPresplash, 1500);
    return () => window.clearTimeout(id);
  }, [show]);
  const pct = typeof progress === "number" && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          data-dashboard-splash
          data-splash-design={mode}
          data-ready={pct >= 100 ? "true" : undefined}
          initial={{ opacity: 1 }}
          exit={beta && !reduceMotion ? { opacity: 0, transform: "scale(1.06)" } : { opacity: 0 }}
          transition={beta ? { duration: reduceMotion ? 0.12 : 0.5, ease: [0.23, 1, 0.32, 1] } : { duration: 0.45, ease: "easeInOut" }}
          className={beta ? "mv-cinema-splash fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden px-6" : "fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-[#08080F] px-6"}
          aria-hidden={beta ? undefined : true}
        >
          {beta ? (
            <>
              <CinemaSplashCanvas onShown={clearPresplash} progress={pct} reduceMotion={reduceMotion} tagline={t("dashboard.splash.tagline")} label={t("dashboard.splash.preparing")} />
              <div className="sr-only">
                <p>Movviz</p>
                <p role="status">{t("dashboard.splash.preparing")}</p>
                <div role="progressbar" aria-label={t("dashboard.splash.loading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} />
              </div>
            </>
          ) : (
            <>
          {/* Fond Movviz haute qualité : void profond + halos brand/magenta/cyan comme TV */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(124,58,237,0.22),transparent_36%),radial-gradient(circle_at_88%_78%,rgba(92,224,216,0.14),transparent_34%),radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.08),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/20" />
          <div className="relative flex flex-col items-center gap-5">
            {/* Entrée pro et sobre : fondu + léger scale-in du lockup
                officiel (fichier réel, jamais redessiné) — pas d'étirement
                ni de déformation. Chargé en priorité : c'est la toute
                première chose que l'utilisateur voit. */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative"
            >
              <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-brand/10 blur-2xl" />
              <img
                src="/brand/movviz-lockup.png"
                alt="Movviz"
                fetchPriority="high"
                loading="eager"
                className="h-auto w-[180px]"
              />
            </motion.div>
            <motion.p
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.25, ease: "easeOut" }}
              className="text-[11px] font-semibold tracking-wide text-white/45"
            >
              Préparation de ton cinéma…
            </motion.p>
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
          </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

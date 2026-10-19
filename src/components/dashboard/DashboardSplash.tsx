"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDesignMode } from "@/components/appearance/AppearanceProvider";
import { BrandSplash } from "./BrandSplash";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { useT } from "@/i18n/provider";
import Image from "next/image";
import "./dashboard-splash.css";
import "./dashboard-splash-classic.css";

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
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : beta ? 0.6 : 0.5, ease: beta ? [0.4, 0, 0.2, 1] : [0.23, 1, 0.32, 1] }}
          className={`${beta ? "mv-m-splash" : "mv-classic-splash"} fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden px-6`}
        >
          {beta ? (
            <>
              <BrandSplash progress={pct} label={t("dashboard.splash.preparing")} loadingLabel={t("dashboard.splash.loading")} onShown={clearPresplash} />
            </>
          ) : (
            // Stable: the Beta cold-start scene as it was on 19 October in the morning (v1.26.051).
            <>
              <div className="mv-splash-atmosphere" aria-hidden="true">
                <div className="mv-splash-projector" />
                <div className="mv-splash-halo mv-splash-halo-violet" />
                <div className="mv-splash-halo mv-splash-halo-cyan" />
                <div className="mv-splash-beam mv-splash-beam-left" />
                <div className="mv-splash-beam mv-splash-beam-right" />
                <div className="mv-splash-aperture" />
                <div className="mv-splash-orbit mv-splash-orbit-one" />
                <div className="mv-splash-orbit mv-splash-orbit-two" />
                <div className="mv-splash-horizon" />
                <div className="mv-splash-shutter mv-splash-shutter-top" />
                <div className="mv-splash-shutter mv-splash-shutter-bottom" />
              </div>
              <div className="mv-splash-stage">
                <p className="mv-splash-eyebrow">{t("dashboard.splash.personalCinema")}</p>
                <div className="mv-splash-logo">
                  <Image src="/brand/movviz-lockup.png" alt="Movviz" width={640} height={640} unoptimized fetchPriority="high" loading="eager" />
                  <div className="mv-splash-logo-sheen" aria-hidden="true" />
                </div>
                <p className="mv-splash-headline">{t("dashboard.splash.headline")}</p>
              </div>
              <div className="mv-splash-loading">
                <div className="mv-splash-loading-label">
                  <p role="status">{t("dashboard.splash.preparing")}</p>
                  <span className="mv-splash-percentage" aria-hidden="true">{Math.round(pct)}<span>%</span></span>
                </div>
                <div className="mv-splash-track" role="progressbar" aria-label={t("dashboard.splash.loading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
                  <div className="mv-splash-fill" style={{ transform: `scaleX(${pct / 100})` }} />
                </div>
              </div>
              <div className="mv-splash-frame" aria-hidden="true"><i /><i /><i /><i /></div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

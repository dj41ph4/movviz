"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { TitleContent } from "@/components/title/TitleContent";
import { PersonContent } from "@/components/title/PersonContent";
import { CollectionContent } from "@/components/title/CollectionContent";
import type { PanelView } from "@/components/title/useTitlePanel";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { computeMorphOrigin, estimateModalGeometry, type MorphTransform, type Rect } from "@/lib/motion/morphOrigin";
import { useT } from "@/i18n/provider";

interface TitlePanelProps {
  view: PanelView;
  onClose: () => void;
}

function estimateMorph(originRect: Rect): MorphTransform | null {
  const final = estimateModalGeometry();
  return final ? computeMorphOrigin(originRect, final) : null;
}

export function TitlePanel({ view, onClose }: TitlePanelProps) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useShouldReduceMotion();
  const originRect = view.kind === "title" ? view.originRect : undefined;
  const [morph] = useState<MorphTransform | null>(() =>
    !originRect || reduceMotion ? null : estimateMorph(originRect)
  );

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  return (
    <motion.div
      data-title-panel
      className="fixed inset-0 z-50 flex items-center justify-center sm:p-6 md:p-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      />

      {/* Centered floating card, Netflix-style — full screen on mobile
          (no room for margins at 375px), a contained modal with its own
          rounded corners everywhere from sm: up. Scale+fade entrance
          instead of the old slide-from-right drawer. */}
      <motion.div
        ref={scrollRef}
        className="relative flex h-full w-full flex-col overflow-y-auto overflow-x-hidden bg-void shadow-2xl sm:h-auto sm:max-h-[88vh] sm:w-full sm:max-w-5xl sm:rounded-2xl sm:border sm:border-white/10"
        initial={morph ? { opacity: 0.5, x: morph.x, y: morph.y, scaleX: morph.scaleX, scaleY: morph.scaleY } : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1 }}
        exit={morph ? { opacity: 0, x: morph.x, y: morph.y, scaleX: morph.scaleX, scaleY: morph.scaleY } : { opacity: 0, scale: 0.96 }}
        transition={morph ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] } : { duration: 0.25, ease: "easeOut" }}
        style={{ transformOrigin: "center center" }}
      >
        {/* The panel shell owns the sticky close action; TitleContent stays
            content-only and therefore renders identically everywhere. */}
        <div className="sticky top-0 z-30 flex items-center justify-end px-4 py-3 pointer-events-none sm:px-6">
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-black/50 px-3 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-black/70"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">{t("common.close")}</span>
          </button>
        </div>
        {/* px-6/pt-6 (sm:px-10/pt-10) matches what TitleContent's video
            header assumes as ambient padding to cancel via its own
            -mx-6/-mt-6 (sm:-mx-10/-mt-10) — without this, the video would be
            clipped narrower than full width instead of breaking out edge to
            edge, since the panel (unlike the standalone page's AppShell
            <main>) has no padding of its own to cancel. */}
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 sm:px-10 sm:pt-10">
          {view.kind === "title" ? (
            <TitleContent
              tmdbId={view.tmdbId}
              type={view.type}
            />
          ) : view.kind === "person" ? (
            <PersonContent id={String(view.personId)} />
          ) : (
            <CollectionContent id={view.collectionId} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

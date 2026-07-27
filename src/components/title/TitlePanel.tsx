"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { TitleContent } from "@/components/title/TitleContent";

interface TitlePanelProps {
  tmdbId: number;
  type: "movie" | "series";
  onClose: () => void;
}

export function TitlePanel({ tmdbId, type, onClose }: TitlePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [tmdbId]);

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
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {/* Fully transparent sticky bar — just a floating circular close
            button at the top-right of the card, Netflix-style, no label/
            background/border of its own. pointer-events-none on the bar
            keeps it from blocking clicks on the video/content underneath. */}
        <div className="sticky top-0 z-30 flex items-center justify-end px-4 py-3 pointer-events-none sm:px-6">
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* px-6/pt-6 (sm:px-10/pt-10) matches what TitleContent's video
            header assumes as ambient padding to cancel via its own
            -mx-6/-mt-6 (sm:-mx-10/-mt-10) — without this, the video would be
            clipped narrower than full width instead of breaking out edge to
            edge, since the panel (unlike the standalone page's AppShell
            <main>) has no padding of its own to cancel. */}
        <div className="mx-auto w-full max-w-[1200px] px-6 pt-6 sm:px-10 sm:pt-10">
          <TitleContent
            tmdbId={tmdbId}
            type={type}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

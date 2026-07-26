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
      className="fixed inset-0 z-50 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      />

      <motion.div
        ref={scrollRef}
        className="relative flex h-full w-full flex-col overflow-y-auto overflow-x-hidden bg-void shadow-2xl sm:rounded-l-2xl sm:border-l sm:border-white/5 md:max-w-[calc(100vw-8rem)]"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 400, mass: 0.9 }}
      >
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-void/90 px-4 py-3 backdrop-blur-sm sm:px-6">
          <button
            onClick={onClose}
            className="flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold text-ink transition-colors hover:bg-white/20"
          >
            <X className="h-4 w-4" />
            Fermer
          </button>
        </div>
        <div className="mx-auto w-full max-w-[1200px]">
          <TitleContent
            tmdbId={tmdbId}
            type={type}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";
import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small glowing dots orbiting the mark — pure CSS rotation, a static offset renders the orbit radius. */
const ORBIT_PARTICLES = [
  { radius: 30, duration: "4.5s", delay: "0s", color: "var(--color-cyan)", reverse: false },
  { radius: 34, duration: "6.5s", delay: "-2s", color: "var(--color-magenta)", reverse: true },
  { radius: 25, duration: "8s", delay: "-4.5s", color: "var(--color-brand-2)", reverse: false },
];

const SIZES = {
  sm: { outer: "h-10 w-10", inner: "h-10 w-10", icon: "h-5 w-5", halo: "-inset-2.5" },
  md: { outer: "h-14 w-14", inner: "h-11 w-11", icon: "h-5 w-5", halo: "-inset-3" },
  lg: { outer: "h-16 w-16", inner: "h-12 w-12", icon: "h-6 w-6", halo: "-inset-4" },
} as const;

/**
 * The single "hero" logo mark treatment — orbiting particles, expanding
 * ripple rings, a rotating aurora halo, and a breathing glow. Used
 * everywhere the brand mark appears (login, sidebar, about) so it reads
 * as the same deliberate animation rather than a simplified copy.
 */
export function AnimatedLogo({ size = "md" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <div className={cn("relative flex items-center justify-center", s.outer)}>
      <span className="logo-ripple absolute inset-0 rounded-full border border-brand/40" />
      <span className="logo-ripple absolute inset-0 rounded-full border border-magenta/30" style={{ animationDelay: "-1.4s" }} />
      <span className={cn("logo-halo absolute -z-10 rounded-full opacity-90", s.halo)} />
      {ORBIT_PARTICLES.map((p, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0"
          style={{
            animation: `logoSpin ${p.duration} linear infinite`,
            animationDelay: p.delay,
            animationDirection: p.reverse ? "reverse" : "normal",
          }}
        >
          <span
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: p.color, boxShadow: `0 0 8px 2px ${p.color}`, transform: `translate(${p.radius}px, -50%)` }}
          />
        </div>
      ))}
      <motion.div
        className={cn("logo-glow-pulse flex items-center justify-center rounded-2xl brand-gradient", s.inner)}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Clapperboard className={cn("text-white", s.icon)} strokeWidth={2.5} />
      </motion.div>
    </div>
  );
}

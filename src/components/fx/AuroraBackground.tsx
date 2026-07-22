"use client";

/**
 * Fixed, GPU-cheap cinematic backdrop: layered radial "aurora" blobs that drift
 * slowly, plus a faint grid. Sits behind all content (z-0) and never scrolls.
 */
export function AuroraBackground() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden bg-void">
      {/* Deep base wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 120% at 50% -10%, var(--aurora-wash-from) 0%, var(--aurora-wash-to) 55%)",
        }}
      />

      {/* Drifting aurora blobs */}
      <div
        className="absolute -top-1/3 -left-1/4 h-[70vh] w-[70vh] rounded-full blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(124,92,255,0.55), transparent 60%)",
          animation: "var(--animate-aurora)",
          opacity: "var(--aurora-blob-1-opacity)",
        }}
      />
      <div
        className="absolute top-1/4 right-[-10%] h-[60vh] w-[60vh] rounded-full blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(255,75,208,0.45), transparent 60%)",
          animation: "var(--animate-aurora)",
          animationDelay: "-6s",
          opacity: "var(--aurora-blob-2-opacity)",
        }}
      />
      <div
        className="absolute bottom-[-20%] left-1/3 h-[55vh] w-[55vh] rounded-full blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, rgba(52,226,255,0.4), transparent 60%)",
          animation: "var(--animate-aurora)",
          animationDelay: "-12s",
          opacity: "var(--aurora-blob-3-opacity)",
        }}
      />

      {/* Fine grid */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(var(--aurora-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--aurora-grid-line) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(120% 90% at 50% 0%, black 30%, transparent 80%)",
        }}
      />
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { RotateCw, AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-down" />
      <h1 className="text-2xl font-bold text-ink">Erreur serveur</h1>
      <p className="max-w-md text-sm text-ink-dim">
        Une erreur inattendue est survenue. L&rsquo;&eacute;quipe a &eacute;t&eacute; notifi&eacute;e.
      </p>
      <button
        onClick={reset}
        className="mt-4 inline-flex items-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
      >
        <RotateCw className="h-4 w-4" />
        R&eacute;essayer
      </button>
    </div>
  );
}

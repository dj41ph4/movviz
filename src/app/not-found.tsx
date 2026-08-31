import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-8xl font-black tracking-widest text-ink-dim/20">404</div>
      <h1 className="text-2xl font-bold text-ink">Page introuvable</h1>
      <p className="max-w-md text-sm text-ink-dim">
        La page que vous cherchez n&apos;existe pas ou a &eacute;t&eacute; d&eacute;plac&eacute;e.
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
      >
        <Home className="h-4 w-4" />
        Retour &agrave; l&apos;accueil
      </Link>
    </div>
  );
}

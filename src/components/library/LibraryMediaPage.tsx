"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Compass, LibraryBig } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryGrid } from "@/components/library/LibraryGrid";
import { MediaSuggestionRows } from "@/components/library/MediaSuggestionRows";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";

/** Films and Series are suggestion-first destinations. Their respective
 * libraries are reached only through the explicit typed library control. */
export function LibraryMediaPage({ type }: { type: "movie" | "series" }) {
  const t = useT();
  const params = useSearchParams();
  const path = type === "movie" ? "/movies" : "/series";
  const libraryOpen = params.get("tab") === "library";
  const title = type === "movie" ? t("common.movies") : t("common.series");

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow={t("library.eyebrow")} title={title} description={t("library.description")} />
      <div className="mb-7 flex items-center justify-between gap-3 border-b border-brand/25 pb-3">
        {libraryOpen ? (
          <Link href={path} scroll={false} className="flex min-h-11 items-center gap-2 rounded-lg border border-brand/35 bg-surface/70 px-3 text-sm font-bold text-ink hover:border-cyan/55">
            <Compass className="h-4 w-4 text-brand-glow" /> {t("discover.rowRecommended")}
          </Link>
        ) : (
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-glow">
            <Compass className="h-4 w-4" /> {t("discover.rowRecommended")}
          </div>
        )}
        {!libraryOpen && <Link
          href={`${path}?tab=library`}
          scroll={false}
          aria-label={`${t("nav.library")} ${title}`}
          className="nx-library-link flex min-h-11 items-center gap-2 rounded-lg border border-cyan/40 bg-surface/70 px-3 text-sm font-bold text-ink transition-colors hover:border-brand-glow hover:text-white"
        >
          <LibraryBig className="h-4 w-4" /> <span>{t("nav.library")}</span>
        </Link>}
      </div>
      {libraryOpen ? <LibraryGrid fixedType={type} /> : <MediaSuggestionRows type={type} />}
    </div>
  );
}

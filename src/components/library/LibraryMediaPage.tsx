"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Compass, Library } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryGrid } from "@/components/library/LibraryGrid";
import { LibraryRecommendedRows } from "@/components/library/LibraryRecommendedRows";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";

/** The dedicated Films / Séries landing: recommendation first, exhaustive
 * Plex-synchronised grid second. Query state keeps the library tab linkable
 * without creating a second route or duplicating the library implementation. */
export function LibraryMediaPage({ type }: { type: "movie" | "series" }) {
  const t = useT();
  const params = useSearchParams();
  const path = type === "movie" ? "/movies" : "/series";
  const libraryOpen = params.get("tab") === "library";
  const title = type === "movie" ? t("common.movies") : t("common.series");

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow={t("library.eyebrow")} title={title} description={t("library.description")} />
      <div className="mb-7 flex flex-wrap gap-1.5 border-b border-white/8 pb-3">
        <Link href={path} scroll={false} className={cn("flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors", !libraryOpen ? "brand-gradient text-white shadow-lg" : "glass text-ink-soft hover:text-ink")}>
          <Compass className="h-4 w-4" /> {t("discover.rowRecommended")}
        </Link>
        <Link href={`${path}?tab=library`} scroll={false} className={cn("flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors", libraryOpen ? "brand-gradient text-white shadow-lg" : "glass text-ink-soft hover:text-ink")}>
          <Library className="h-4 w-4" /> {t("nav.library")}
        </Link>
      </div>
      {libraryOpen ? <LibraryGrid fixedType={type} /> : <LibraryRecommendedRows type={type} />}
    </div>
  );
}

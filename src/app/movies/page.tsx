"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryGrid } from "@/components/library/LibraryGrid";
import { useT } from "@/i18n/provider";

export default function MoviesPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow={t("library.eyebrow")} title={t("common.movies")} description={t("library.description")} />
      <LibraryGrid fixedType="movie" />
    </div>
  );
}
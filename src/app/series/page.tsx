"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryGrid } from "@/components/library/LibraryGrid";
import { useT } from "@/i18n/provider";
import { useTitlePanel } from "@/components/title/useTitlePanel";

export default function SeriesPage() {
  const t = useT();
  const { titlePanel } = useTitlePanel();
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow={t("library.eyebrow")} title={t("common.series")} description={t("library.description")} />
      <LibraryGrid fixedType="series" />
      {titlePanel}
    </div>
  );
}
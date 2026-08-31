"use client";

import { LibraryMediaPage } from "@/components/library/LibraryMediaPage";
import { useTitlePanel } from "@/components/title/useTitlePanel";

export default function SeriesPage() {
  const { titlePanel } = useTitlePanel();
  return (
    <>
      <LibraryMediaPage type="series" />
      {titlePanel}
    </>
  );
}

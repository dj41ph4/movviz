"use client";

import { use, useEffect } from "react";
import { TitleContent } from "@/components/title/TitleContent";
import { useTitlePanel } from "@/components/title/useTitlePanel";

export default function TitleDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type: rawType, id } = use(params);
  const type = rawType === "series" ? "series" : "movie";
  const tmdbId = Number(id);
  const { titlePanel } = useTitlePanel();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
  }, [tmdbId]);

  return (
    <div className="mx-auto max-w-[1200px]">
      {titlePanel}
      <TitleContent tmdbId={tmdbId} type={type} />
    </div>
  );
}

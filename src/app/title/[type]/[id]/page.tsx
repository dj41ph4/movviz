"use client";

import { Suspense, use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/i18n/provider";
import { parseBleachPart } from "@/lib/metadata/bleachPresentation";
import { TitleContent } from "@/components/title/TitleContent";
import { useTitlePanel } from "@/components/title/useTitlePanel";

export default function TitleDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  return <Suspense fallback={null}><TitleDetailBody params={params} /></Suspense>;
}

function TitleDetailBody({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type: rawType, id } = use(params);
  const type = rawType === "series" ? "series" : "movie";
  const tmdbId = Number(id);
  const seriesPart = parseBleachPart(useSearchParams().get("part"));
  const { titlePanel } = useTitlePanel();
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
  }, [tmdbId]);

  return (
    <div className="touch-title-page mx-auto max-w-[1200px] overflow-x-hidden lg:overflow-visible">
      {titlePanel}
      <button
        type="button"
        className="touch-title-page-back ring-focus"
        aria-label={t("common.back")}
        onClick={() => window.history.length > 1 ? router.back() : router.replace("/discover")}
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      {/* Below desktop, swap <main>'s own padding for the one TitleContent's
          full-bleed header cancels (-mx-6/-mt-6, sm:-mx-10/-mt-10), as in the
          title panel — otherwise the header overhangs and clips the copy. */}
      <div className="touch-title-page-content -mx-4 -mt-5 px-6 pt-6 sm:-mx-5 sm:-mt-6 sm:px-10 sm:pt-10 md:-mx-8 md:-mt-8 lg:m-0 lg:p-0">
        <TitleContent key={`${tmdbId}:${seriesPart ?? ""}`} tmdbId={tmdbId} type={type} seriesPart={seriesPart} standalonePage />
      </div>
    </div>
  );
}

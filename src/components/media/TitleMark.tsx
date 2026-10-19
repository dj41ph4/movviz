"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { useLogoRetry } from "@/lib/useLogoRetry";
import { TmdbImage } from "@/components/media/TmdbImage";

/**
 * Resolves one hero's official title mark. It waits three seconds before
 * showing the text title as a stand-in, but the official logo always takes
 * over as soon as it resolves — a slow or retried request must not leave the
 * slide on text until the visitor changes slide.
 */
export function TitleMark({
  tmdbId,
  type,
  title,
  locale,
  className,
  logoClassName,
}: {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  locale: string;
  className?: string;
  logoClassName?: string;
}) {
  const [display, setDisplay] = useState<"pending" | "logo" | "title">("pending");
  const retry = useLogoRetry<{ logos: { filePath: string }[] }>((data) => !!data?.logos?.length);
  const { data: images } = useSWR<{ logos: { filePath: string }[] }>(
    `/api/metadata/images?tmdbId=${tmdbId}&type=${type}&locale=${locale}`,
    { refreshInterval: retry }
  );
  const logoPath = images?.logos?.[0]?.filePath ?? null;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDisplay((current) => (current === "pending" ? "title" : current));
    }, 3_000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!logoPath) return;
    setDisplay("logo");
  }, [logoPath]);

  return (
    <h2 className={cn("min-h-12 max-w-2xl text-2xl font-black tracking-tight text-white drop-shadow-lg sm:min-h-24 sm:text-4xl", className)}>
      {display === "logo" && logoPath ? (
        <>
          <span className="sr-only">{title}</span>
          <TmdbImage
            path={logoPath}
            size="w500"
            alt=""
            loading="lazy"
            className={cn("max-h-16 max-w-[70vw] object-contain object-left align-middle sm:max-h-24 sm:max-w-md", logoClassName)}
          />
        </>
      ) : display === "title" ? (
        title
      ) : (
        <span className="sr-only">{title}</span>
      )}
    </h2>
  );
}

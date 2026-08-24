"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { TmdbImage } from "@/components/media/TmdbImage";

/**
 * Resolves one hero's official title mark. It deliberately waits three
 * seconds before falling back to text, then keeps that fallback stable for
 * the rest of the slide instead of replacing it with a late image response.
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
  const { data: images } = useSWR<{ logos: { filePath: string }[] }>(
    `/api/metadata/images?tmdbId=${tmdbId}&type=${type}&locale=${locale}`
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
    setDisplay((current) => (current === "pending" ? "logo" : current));
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

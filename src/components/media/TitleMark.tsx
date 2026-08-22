"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";

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
  const logoUrl = images?.logos?.[0]?.filePath ? `/tmdb/w500${images.logos[0].filePath}` : null;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDisplay((current) => (current === "pending" ? "title" : current));
    }, 3_000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!logoUrl) return;
    setDisplay((current) => (current === "pending" ? "logo" : current));
  }, [logoUrl]);

  return (
    <h2 className={cn("min-h-12 max-w-2xl text-2xl font-black tracking-tight text-white drop-shadow-lg sm:min-h-24 sm:text-4xl", className)}>
      {display === "logo" && logoUrl ? (
        <>
          <span className="sr-only">{title}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
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

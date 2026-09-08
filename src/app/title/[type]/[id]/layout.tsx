import type { Metadata } from "next";
import { getDetail } from "@/lib/metadata/tmdb";

interface Props {
  params: Promise<{ type: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, id } = await params;
  const tmdbId = Number(id);
  try {
    // Direct in-process call instead of the page fetching its own API route
    // over HTTP: that self-fetch carried no session cookie, so /api/metadata/
    // detail's requireUser() always rejected it (403, silently swallowed
    // below) — every title page's <title> tag was therefore always the
    // generic "Film"/"Série" fallback, never the real title. Calling getDetail
    // directly also skips a redundant network round-trip on every page load.
    const detail = Number.isFinite(tmdbId) ? await getDetail(type === "series" ? "series" : "movie", tmdbId, "fr") : null;
    if (detail?.title) return { title: detail.title };
  } catch { /* fallback */ }
  return { title: type === "movie" ? "Film" : "Série" };
}

export default function TitleDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}

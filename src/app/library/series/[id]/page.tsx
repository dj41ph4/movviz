import { redirect } from "next/navigation";
import { getSeries } from "@/lib/library/store";

/**
 * This route used to be the series detail page; it's now folded into
 * /title/series/[tmdbId] (richer TMDb metadata + every download action),
 * so the only job left here is sending old links/bookmarks to the right
 * place instead of 404ing.
 */
export default async function LegacySeriesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const series = getSeries(id);
  if (!series) redirect("/library");
  redirect(`/title/series/${series.tmdbId}`);
}

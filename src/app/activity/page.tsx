import { redirect } from "next/navigation";

/** "Activité" was renamed "Téléchargements" (/downloads) — this old URL is
 *  kept as a redirect so existing bookmarks/links (including the
 *  notification links built by autoGrabSeries.ts et al. before they're all
 *  updated, and anyone's own bookmarks) keep working. Forwards the query
 *  string so a deep link like /activity?tab=wanted still lands on the right
 *  tab at /downloads?tab=wanted. */
export default async function ActivityRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
  }
  const suffix = qs.toString();
  redirect(`/downloads${suffix ? `?${suffix}` : ""}`);
}

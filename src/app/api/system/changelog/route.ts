import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getAppVersion } from "@/lib/updates/version";
import { getChangelogRange } from "@/lib/changelog";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

/** `?since=1.0.30` returns every release between 1.0.30 (exclusive) and the running version — everything the caller missed, not just the latest. Omit `since` (first-ever launch) to get just the current version. `?locale=` selects which language the entries come back in (falls back to English for anything not yet translated). */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const version = getAppVersion();
  const since = req.nextUrl.searchParams.get("since");
  const localeParam = req.nextUrl.searchParams.get("locale");
  const locale: Locale = LOCALES.includes(localeParam as Locale) ? (localeParam as Locale) : DEFAULT_LOCALE;
  const entries = getChangelogRange(since, version, locale);
  return NextResponse.json({ version, entries, entry: entries[0] ?? null });
}

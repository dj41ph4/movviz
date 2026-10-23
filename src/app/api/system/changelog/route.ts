import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getAppVersion } from "@/lib/updates/version";
import { getChangelogRange } from "@/lib/changelog";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/config";
import { loadUserPrefs } from "@/lib/userPrefs/store";

export const dynamic = "force-dynamic";

/** `?since=1.0.30` returns every missed release. `?lang=en` follows the
 * selected UI language; callers without it use the account preference. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const version = getAppVersion();
  const since = req.nextUrl.searchParams.get("since");
  const requested = req.nextUrl.searchParams.get("lang");
  const preferred = loadUserPrefs(user.id).locale ?? DEFAULT_LOCALE;
  const locale: Locale = requested && (LOCALES as readonly string[]).includes(requested) ? requested as Locale : preferred;
  const entries = getChangelogRange(since, version, locale);
  return NextResponse.json({ version, locale, entries, entry: entries[0] ?? null });
}

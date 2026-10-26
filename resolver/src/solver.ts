import type { ResolverSession } from "./browser.js";
import { isChallengePage } from "./browser.js";

export interface ResolveResult {
  success: boolean;
  url: string;
  status: number;
  cookies: { name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite: string }[];
  userAgent: string;
  headers: Record<string, string>;
  body: string;
  contentType: string;
}

export async function resolveChallenge(
  session: ResolverSession,
  targetUrl: string,
  timeout: number,
  returnOnlyCookies: boolean,
  blockMedia: boolean
): Promise<ResolveResult> {
  const { page } = session;
  const startTime = Date.now();
  const deadline = startTime + timeout * 1000;

  if (blockMedia) {
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "media" || type === "font") {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: Math.max(1000, deadline - Date.now()),
    });
    const status = response?.status() ?? 200;
    let currentUrl = page.url();

    let title = await page.title();
    let challenged = false;

    while (isChallengePage(title) && Date.now() < deadline) {
      challenged = true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;

      try {
        await page.waitForTimeout(2000);
        await page.waitForLoadState("networkidle", { timeout: Math.min(remaining, 15000) });
      } catch {}

      title = await page.title();
      currentUrl = page.url();
    }

    if (!challenged) {
      try {
        await page.waitForLoadState("networkidle", { timeout: Math.min(deadline - Date.now(), 30000) });
      } catch {}
    }

    const cookies = await session.context.cookies();
    const userAgent = await page.evaluate(() => navigator.userAgent);

    let body = "";
    let contentType = "text/html";

    if (returnOnlyCookies) {
      body = "";
    } else if (response?.headers()["content-type"]?.startsWith("application/pdf")) {
      contentType = "application/pdf";
      try {
        const fetchResponse = await page.request.fetch(currentUrl);
        body = Buffer.from(await fetchResponse.body()).toString("base64");
      } catch {
        contentType = "text/html";
        body = await page.content();
      }
    } else {
      body = await page.content();
    }

    return {
      success: true,
      url: currentUrl,
      status,
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite as string,
      })),
      userAgent,
      headers: response?.headers() ?? {},
      body,
      contentType,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      url: targetUrl,
      status: 408,
      cookies: [],
      userAgent: "",
      headers: {},
      body: message,
      contentType: "text/plain",
    };
  }
}

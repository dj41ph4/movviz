import type { ResolverSession } from "./browser.js";
import { isChallengePage } from "./browser.js";
import type { Response } from "playwright";

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
  timeoutMs: number,
  returnOnlyCookies: boolean,
  blockMedia: boolean
): Promise<ResolveResult> {
  const { page } = session;
  const startTime = Date.now();
  const deadline = startTime + timeoutMs;

  // A named session reuses its page; media blocking must not leak to later calls.
  await page.unroute("**/*");

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

  let finalResponse: Response | null = null;
  const onResponse = (response: Response) => {
    if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) finalResponse = response;
  };
  page.on("response", onResponse);

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: Math.max(1000, deadline - Date.now()),
    });
    let currentUrl = page.url();

    let title = await page.title();
    let challenged = false;

    while (await hasChallenge(page, title) && Date.now() < deadline) {
      challenged = true;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;

      try {
        await page.waitForTimeout(Math.min(2000, remaining));
        await page.waitForLoadState("networkidle", { timeout: Math.min(remaining, 15000) });
      } catch {}

      title = await page.title();
      currentUrl = page.url();
    }

    if (!challenged) {
      try {
        await page.waitForLoadState("networkidle", { timeout: Math.max(1, Math.min(deadline - Date.now(), 30000)) });
      } catch {}
    }

    title = await page.title();
    currentUrl = page.url();
    if (await hasChallenge(page, title)) {
      throw new Error("Cloudflare challenge remains unresolved");
    }

    const cookies = await session.context.cookies();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const currentResponse = finalResponse as Response | null;
    const status = currentResponse?.status() ?? response?.status() ?? 200;
    const headers = currentResponse?.headers() ?? response?.headers() ?? {};

    let body = "";
    let contentType = "text/html";

    if (returnOnlyCookies) {
      body = "";
    } else if (headers["content-type"]?.startsWith("application/pdf")) {
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
      headers,
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
  } finally {
    page.off("response", onResponse);
  }
}

async function hasChallenge(page: ResolverSession["page"], title: string): Promise<boolean> {
  if (isChallengePage(title)) return true;
  const url = page.url();
  if (url.includes("/cdn-cgi/challenge-platform/") || url.includes("__cf_chl_tk=")) return true;
  return page.locator("#challenge-form, #challenge-running, .cf-browser-verification").count().then((count) => count > 0).catch(() => false);
}

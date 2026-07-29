import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

// Use a fixed browsers path relative to the resolver's working directory
// so Playwright works identically regardless of the user running the service
// (Windows SYSTEM, Docker, Linux, NAS).
const BROWSERS_PATH = path.join(process.cwd(), ".playwright-browsers");
process.env.PLAYWRIGHT_BROWSERS_PATH = BROWSERS_PATH;

const CHALLENGE_TITLES = ["Just a moment...", "Please stand by...", "Checking your browser before accessing"];

export interface ResolverSession {
  context: BrowserContext;
  page: Page;
}

let browser: Browser | null = null;

async function ensureBrowsersInstalled(): Promise<void> {
  if (fs.existsSync(BROWSERS_PATH)) return;
  try {
    execSync("npx playwright install chromium", {
      cwd: process.cwd(),
      stdio: "pipe",
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: BROWSERS_PATH },
      timeout: 120_000,
    });
  } catch (e) {
    // If offline, the existing install check above already failed —
    // let chromium.launch() produce the native "not installed" error.
  }
}

export async function getBrowser(): Promise<Browser> {
  if (browser) return browser;

  await ensureBrowsersInstalled();

  browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-web-security",
      "--disable-infobars",
      "--disable-dev-shm-usage",
      "--disable-browser-side-navigation",
      "--disable-gpu",
      "--hide-scrollbars",
      "--mute-audio",
    ],
  });
  return browser;
}

export async function createSession(proxy?: { server: string; username?: string; password?: string }): Promise<ResolverSession> {
  const br = await getBrowser();
  const context = await br.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    locale: "en-US",
    timezoneId: "America/New_York",
    proxy: proxy
      ? { server: proxy.server, username: proxy.username, password: proxy.password }
      : undefined,
  });

  const page = await context.newPage();
  await patchPage(page);

  return { context, page };
}

async function patchPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    (window as any).chrome = { runtime: {} };
    const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (p: any) =>
      p.name === "notifications" ? Promise.resolve({ state: "denied" } as PermissionStatus) : originalQuery(p);
  });
}

export function isChallengePage(title: string): boolean {
  return CHALLENGE_TITLES.some((t) => title.includes(t));
}

export async function closeSession(session: ResolverSession): Promise<void> {
  try { await session.page.close(); } catch {}
  try { await session.context.close(); } catch {}
}

export async function shutdown(): Promise<void> {
  if (browser) {
    try { await browser.close(); } catch {}
    browser = null;
  }
}

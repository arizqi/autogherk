import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import type { AuthStrategy, DiscoveredInteraction } from "./types.js";
import { isDestructiveAction, isExternalLink } from "./safety.js";

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

const AUTH_DIR = join(homedir(), ".autogherk", "auth");

function authStatePath(url: string): string {
  const domain = new URL(url).hostname.replace(/\./g, "_");
  return join(AUTH_DIR, `${domain}.json`);
}

/**
 * Launch browser with saved auth state if available.
 */
export async function launchBrowser(url?: string): Promise<BrowserSession> {
  let storageState: string | undefined;

  // Try to load saved auth state for this domain
  if (url) {
    const statePath = authStatePath(url);
    try {
      await readFile(statePath, "utf-8");
      storageState = statePath;
    } catch {
      // No saved state — that's fine
    }
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("Executable doesn't exist") ||
      msg.includes("playwright install") ||
      msg.includes("browserType.launch")
    ) {
      throw new Error(
        "Chromium binary not found. Install it with:\n\n  npx playwright install chromium\n\nThen re-run autogherk explore.",
      );
    }
    throw err;
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * Interactive login: opens a visible browser, user logs in manually,
 * session is saved for future runs. Like `gh auth login`.
 */
export async function interactiveLogin(url: string): Promise<void> {
  console.log(`\nOpening browser for login to ${new URL(url).hostname}...`);
  console.log("Log in as you normally would, then return here and press Enter.\n");

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Executable doesn't exist") || msg.includes("playwright install")) {
      throw new Error(
        "Chromium binary not found. Install it with:\n\n  npx playwright install chromium\n\nThen re-run autogherk explore.",
      );
    }
    throw err;
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait for user to press Enter in the terminal
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.question("Press Enter once you've logged in... ", () => {
      rl.close();
      resolve();
    });
  });

  // Save the browser state (cookies, localStorage, etc.)
  await mkdir(AUTH_DIR, { recursive: true });
  const statePath = authStatePath(url);
  const state = await context.storageState();
  await writeFile(statePath, JSON.stringify(state, null, 2));

  await browser.close();

  console.log(`✓ Auth saved to ${statePath}`);
  console.log(`  Future runs against ${new URL(url).hostname} will reuse this session.\n`);
}

/**
 * Check if we have saved auth for a given URL.
 */
export async function hasSavedAuth(url: string): Promise<boolean> {
  try {
    await readFile(authStatePath(url), "utf-8");
    return true;
  } catch {
    return false;
  }
}

export async function injectAuth(
  session: BrowserSession,
  auth: AuthStrategy,
  url: string,
): Promise<void> {
  const { context, page } = session;

  switch (auth.type) {
    case "cookie": {
      if (!auth.cookie) throw new Error("Auth cookie value is required");
      const domain = new URL(url).hostname;
      const cookies = auth.cookie.split(";").map((pair) => {
        const [name, ...rest] = pair.trim().split("=");
        return { name, value: rest.join("="), domain, path: "/" };
      });
      await context.addCookies(cookies);
      break;
    }
    case "token": {
      if (!auth.token) throw new Error("Auth token value is required");
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.evaluate((token) => {
        localStorage.setItem("token", token);
        localStorage.setItem("access_token", token);
      }, auth.token);
      await page.reload({ waitUntil: "domcontentloaded" });
      break;
    }
    case "login": {
      if (!auth.loginUrl || !auth.email || !auth.password) {
        throw new Error("Login URL, email, and password are required for login auth");
      }
      await page.goto(auth.loginUrl, { waitUntil: "domcontentloaded" });
      const emailField =
        page.locator('input[type="email"]').or(
          page.locator('input[name="email"]').or(
            page.locator('input[name="username"]'),
          ),
        );
      const passwordField = page.locator('input[type="password"]');
      await emailField.first().fill(auth.email);
      await passwordField.first().fill(auth.password);
      await passwordField.first().press("Enter");
      await page.waitForURL((u) => u.toString() !== auth.loginUrl, { timeout: 10000 });
      break;
    }
  }
}

/**
 * Extract all interactive elements from the current page.
 */
export async function extractInteractions(
  page: Page,
  baseUrl: string,
  skipPatterns: string[] = [],
): Promise<DiscoveredInteraction[]> {
  const elements = await page.evaluate(() => {
    const results: Array<{
      selector: string;
      type: string;
      text: string;
      role: string;
      href?: string;
      tagName: string;
    }> = [];

    const interactiveSelectors = [
      "a[href]",
      "button",
      'input[type="submit"]',
      'input[type="button"]',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      "[onclick]",
    ];

    const seen = new Set<string>();

    for (const selector of interactiveSelectors) {
      for (const el of document.querySelectorAll(selector)) {
        const htmlEl = el as HTMLElement;
        if (htmlEl.offsetParent === null && htmlEl.style.position !== "fixed") continue;

        const text = (htmlEl.textContent ?? "").trim().slice(0, 100);
        const href = (el as HTMLAnchorElement).href || undefined;
        const role = el.getAttribute("role") ?? el.tagName.toLowerCase();
        const tag = el.tagName.toLowerCase();

        const id = el.id ? `#${el.id}` : "";
        const classes = Array.from(el.classList).slice(0, 2).join(".");
        const nthSelector = id
          ? `${tag}${id}`
          : classes
            ? `${tag}.${classes}`
            : `${tag}:nth-of-type(${Array.from(el.parentElement?.children ?? []).indexOf(el) + 1})`;

        const key = `${nthSelector}|${text}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let type: string;
        if (tag === "a" && href) type = "navigate";
        else if (tag === "input" || tag === "select" || tag === "textarea") type = "fill";
        else type = "click";

        results.push({ selector: nthSelector, type, text, role, href, tagName: tag });
      }
    }

    return results;
  });

  return elements.map((el) => ({
    selector: el.selector,
    type: el.type as DiscoveredInteraction["type"],
    elementText: el.text,
    elementRole: el.role,
    href: el.href,
    isDestructive: isDestructiveAction(el.text, el.role, el.href, skipPatterns) ||
      (el.href ? isExternalLink(el.href, baseUrl) : false),
    explored: false,
  }));
}

export async function takeScreenshot(
  page: Page,
  outputDir: string,
  screenId: string,
): Promise<string> {
  const dir = join(outputDir, "exploration-report", "screenshots");
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${screenId}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

export async function fillFormFields(page: Page): Promise<void> {
  const fields = await page.$$("input:visible, select:visible, textarea:visible");

  for (const field of fields) {
    const tagName = await field.evaluate((el) => el.tagName.toLowerCase());
    const type = await field.getAttribute("type") ?? "text";
    const name = (await field.getAttribute("name") ?? await field.getAttribute("placeholder") ?? "").toLowerCase();

    try {
      if (tagName === "select") {
        const options = await field.$$eval("option", (opts) =>
          opts.filter((o) => o.value).map((o) => o.value),
        );
        if (options.length > 1) await field.selectOption(options[1]);
      } else if (tagName === "textarea") {
        await field.fill("Test description for automated exploration.");
      } else if (type === "email" || name.includes("email")) {
        await field.fill("test@example.com");
      } else if (type === "password" || name.includes("password")) {
        await field.fill("TestPassword123!");
      } else if (type === "tel" || name.includes("phone")) {
        await field.fill("+1-555-000-0000");
      } else if (type === "number" || name.includes("amount") || name.includes("quantity")) {
        await field.fill("42");
      } else if (type === "url") {
        await field.fill("https://example.com");
      } else if (type === "date") {
        await field.fill("2026-01-15");
      } else if (name.includes("name") || name.includes("first")) {
        await field.fill("Test User");
      } else if (type === "search" || name.includes("search")) {
        await field.fill("test query");
      } else if (type === "text" || type === "") {
        await field.fill("Test value");
      }
    } catch {
      // skip fields that can't be filled
    }
  }
}

export async function closeBrowser(session: BrowserSession): Promise<void> {
  await session.browser.close();
}

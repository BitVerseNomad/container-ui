import { expect, type BrowserContext, type Page } from "@playwright/test";

type Options = { width?: number; height?: number; colorScheme?: "light" | "dark" };

// openPage(page, "/?scenario=running#/containers") sizes the page (1280x800, light by default) and loads the preview.
// A page error fails the test, as it did in the old browser checks.
export const openPage = async (page: Page, path = "/", { width = 1280, height = 800, colorScheme = "light" }: Options = {}) => {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme });
  page.on("pageerror", (e) => expect.soft(false, `page error: ${String(e).slice(0, 200)}`).toBe(true));
  await page.goto(path); // relative to baseURL in playwright.config.ts
  return page;
};

// For a test that needs several pages: const open = opener(context); const a = await open("/#/images");
export const opener = (context: BrowserContext) => async (path?: string, options?: Options) => openPage(await context.newPage(), path, options);

import { test as base, type Page } from '@playwright/test';

export { expect } from '@playwright/test';

/**
 * Waits until React has moved every streamed Suspense chunk into place. Until
 * then a chunk's content can exist twice in the DOM (once in a hidden
 * `<div id="S:…">`), which trips Playwright's strict locators.
 */
export async function waitForStreaming(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'), undefined, {
    timeout: 15_000,
  });
}

/** `test` whose `page.goto` / `page.reload` resolve once the streamed page has settled. */
export const test = base.extend({
  // Playwright fixture callback (`provide`), not a React hook.
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await waitForStreaming(page).catch(() => undefined);
      return response;
    };
    const reload = page.reload.bind(page);
    page.reload = async (options) => {
      const response = await reload(options);
      await waitForStreaming(page).catch(() => undefined);
      return response;
    };
    await provide(page);
  },
});

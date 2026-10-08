import { expect, test } from '@playwright/test';

/**
 * Acceptance: a single token change restyles the whole site. Overriding a token
 * on :root at runtime must change every element that uses it, which proves no
 * component hard-codes the value.
 */
test('changing a single token restyles every element that uses it', async ({ page }) => {
  await page.goto('/');
  const styles = () =>
    page.evaluate(() => {
      const h1 = getComputedStyle(document.querySelector('h1') as Element);
      const primaryButtons = [...document.querySelectorAll('main a')]
        .map((a) => getComputedStyle(a).backgroundColor)
        .filter((color) => color !== 'rgba(0, 0, 0, 0)');
      return {
        h1Size: h1.fontSize,
        h1Tracking: h1.letterSpacing,
        bodyFont: getComputedStyle(document.body).fontFamily,
        buttons: primaryButtons,
      };
    });

  const before = await styles();
  await page.evaluate(() => {
    const root = document.documentElement.style;
    root.setProperty('--color-primary', 'rgb(12, 34, 56)');
    root.setProperty('--type-display-size', '20px');
    root.setProperty('--type-display-letter-spacing', '2px');
    root.setProperty('--font-body', 'monospace');
  });
  // Buttons animate color changes (motion tokens): wait for transitions to settle.
  await expect.poll(async () => (await styles()).buttons).toContain('rgb(12, 34, 56)');
  const after = await styles();

  expect(after.h1Size).toBe('20px');
  expect(after.h1Tracking).toBe('2px');
  expect(before.h1Size).not.toBe('20px');
  expect(after.bodyFont).toBe('monospace');
  expect(after.buttons).toContain('rgb(12, 34, 56)');
  expect(before.buttons).not.toContain('rgb(12, 34, 56)');
});

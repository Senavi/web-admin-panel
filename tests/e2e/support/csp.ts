import type { Page } from '@playwright/test';

/** Collects Content-Security-Policy violations reported in the browser console. */
export function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Content Security Policy|Refused to (execute|load|apply)/i.test(message.text())
    ) {
      violations.push(message.text());
    }
  });
  return violations;
}

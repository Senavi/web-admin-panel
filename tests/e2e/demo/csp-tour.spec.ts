import { admin } from '../support/admin';
import { login } from '../support/auth';
import { collectCspViolations } from '../support/csp';
import { expect, test } from '../support/test';
import { E2E_ADMIN } from '../support/users';

test('demo pages run without CSP violations (blog, contact form, collections, inbox)', async ({
  page,
}) => {
  const violations = collectCspViolations(page);
  await page.goto('/uk/about/team');
  await page.goto('/blog');
  await page.goto('/blog/hello-world');
  await page.goto('/contact');
  await expect(page.locator('form#form-contact input[name="_t"]')).toBeAttached();
  await login(page, E2E_ADMIN);
  await page.goto(admin('/pages/about'));
  await expect(page.locator('form[data-hydrated]')).toBeVisible();
  await page.goto(admin('/pages/collections/blog'));
  await page.goto(admin('/pages/forms/contact'));
  await expect(page.getByRole('table', { name: 'Requests' })).toBeVisible();
  expect(violations).toEqual([]);
});

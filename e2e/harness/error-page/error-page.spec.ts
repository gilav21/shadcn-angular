import { test, expect } from '@playwright/test';

/**
 * T-16 for `error-page` — proves the page installs and renders in a pristine
 * consumer app, that its default copy travels with it, and that the recovery
 * actions emit rather than navigate.
 */

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('error-page renders the code and its default copy', async ({ page }) => {
    const page404 = page.getByTestId('default').locator('[data-slot="error-page"]');
    await expect(page404).toBeVisible();
    await expect(page404.locator('[data-slot="error-page-code"]')).toHaveText('404');
    await expect(page404.locator('[data-slot="error-page-title"]')).toHaveText(
        'Page not found',
    );
    await expect(page404.locator('[data-slot="error-page-description"]')).toContainText(
        "doesn't exist",
    );
});

test('error-page renders the title as a real h1', async ({ page }) => {
    const title = page.getByTestId('default').locator('[data-slot="error-page-title"]');
    await expect(title).toHaveJSProperty('tagName', 'H1');
});

test('error-page hides the decorative code from assistive tech', async ({ page }) => {
    await expect(
        page.getByTestId('default').locator('[data-slot="error-page-code"]'),
    ).toHaveAttribute('aria-hidden', 'true');
});

test('error-page falls back to generic copy for an unknown code', async ({ page }) => {
    const unknown = page.getByTestId('unknown').locator('[data-slot="error-page"]');
    await expect(unknown.locator('[data-slot="error-page-code"]')).toHaveText('418');
    await expect(unknown.locator('[data-slot="error-page-title"]')).toHaveText(
        'Something went wrong',
    );
});

test('error-page default actions emit rather than navigate', async ({ page }) => {
    const urlBefore = page.url();
    const readout = page.getByTestId('last-event');
    await expect(readout).toHaveText('none');

    const target = page.getByTestId('default');
    await target.locator('[data-slot="error-page-back"] button').click();
    await expect(readout).toHaveText('goBack');

    await target.locator('[data-slot="error-page-home"] button').click();
    await expect(readout).toHaveText('goHome');

    expect(page.url()).toBe(urlBefore);
});

test('error-page replaces the code when an illustration is projected', async ({
    page,
}) => {
    const illustrated = page.getByTestId('illustrated');
    await expect(illustrated.getByTestId('custom-art')).toBeVisible();
    await expect(illustrated.locator('[data-slot="error-page-code"]')).toHaveCount(0);
});

test('error-page replaces both defaults when actions are projected', async ({ page }) => {
    const custom = page.getByTestId('custom-actions');
    await expect(custom.getByTestId('custom-action')).toBeVisible();
    await expect(custom.locator('[data-slot="error-page-back"]')).toHaveCount(0);
    await expect(custom.locator('[data-slot="error-page-home"]')).toHaveCount(0);
    await expect(custom.locator('[data-slot="error-page-actions"]')).toHaveCount(1);
});

test('error-page stays inside a 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
});

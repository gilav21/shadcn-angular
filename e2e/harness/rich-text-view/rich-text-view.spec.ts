import { test, expect, type Page } from '@playwright/test';

// T-32 — the view installed the way a consumer installs it. The unit specs run
// against the workspace source; this is the only place that proves the registry
// actually ships the files the component needs and that the typography classes
// survive the consumer's Tailwind build (a class-name assertion would not).

const content = (page: Page, testId: string) =>
    page.locator(`[data-testid="${testId}"] [data-slot="rich-text-view"]`);

test('renders sanitized HTML with no script executed', async ({ page }) => {
    await page.goto('/');
    const view = content(page, 'view-html');

    await expect(view.locator('h1')).toHaveText('Title');
    await expect(view.locator('p')).toHaveText('Body');
    await expect(view.locator('script')).toHaveCount(0);
    expect(await page.evaluate(() => (globalThis as Record<string, unknown>)['pwned'])).toBeUndefined();
});

test('renders markdown', async ({ page }) => {
    await page.goto('/');
    const view = content(page, 'view-md');

    await expect(view.locator('h1')).toHaveText('Md');
    await expect(view.locator('strong')).toHaveText('bold');
});

test('the shared typography reaches the DOM: h1 is larger and heavier than body text', async ({ page }) => {
    await page.goto('/');
    const view = content(page, 'view-html');

    const h1 = await view.locator('h1').evaluate((el) => {
        const s = getComputedStyle(el);
        return { size: Number.parseFloat(s.fontSize), weight: Number.parseInt(s.fontWeight, 10) };
    });
    const p = await view.locator('p').evaluate((el) => {
        const s = getComputedStyle(el);
        return { size: Number.parseFloat(s.fontSize), weight: Number.parseInt(s.fontWeight, 10) };
    });

    expect(h1.weight).toBeGreaterThanOrEqual(700);
    expect(h1.size).toBeGreaterThan(p.size);
});

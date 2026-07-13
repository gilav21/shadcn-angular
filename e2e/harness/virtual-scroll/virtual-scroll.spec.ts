import { test, expect } from '@playwright/test';

test('virtual-scroll windows the list and swaps rows in as you scroll', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    const rows = page.locator('[data-row]');
    const initial = await rows.count();
    expect(initial).toBeGreaterThan(0);
    // Windowed: nowhere near all 500 rows are in the DOM.
    expect(initial).toBeLessThan(100);
    await expect(page.locator('[data-row="0"]')).toBeVisible();

    const viewport = page.locator('[data-slot="virtual-scroll"]');
    await viewport.evaluate((el: HTMLElement) => { el.scrollTop = 4000; });

    await expect(page.locator('[data-row="0"]')).toHaveCount(0);
    expect(await rows.count()).toBeLessThan(100);
});

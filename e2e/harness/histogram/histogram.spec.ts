import { test, expect } from '@playwright/test';

test('histogram renders one bar per bin', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('[data-slot="histogram-bar"]')).toHaveCount(8);
});

test('histogram bars are keyboard focusable and labelled', async ({ page }) => {
    await page.goto('/');
    const first = page.locator('[data-slot="histogram-bar"]').first();
    await first.focus();
    await expect(first).toBeFocused();
    await expect(first).toHaveAttribute('aria-label', /\d/);
});

test('histogram shows a tooltip with the bin range on hover', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-slot="histogram-bar"]').nth(2).hover();
    await expect(page.locator('[data-slot="chart-tooltip"]')).toBeVisible();
    await expect(page.locator('[data-slot="chart-tooltip"]')).toContainText('Count');
});

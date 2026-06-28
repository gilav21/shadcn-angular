import { test, expect } from '@playwright/test';

test('radar-chart renders one polygon per series', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('path[data-slot="radar-series"]')).toHaveCount(2);
});

test('radar-chart legend toggles a series', async ({ page }) => {
    await page.goto('/');
    const polys = page.locator('path[data-slot="radar-series"]');
    await expect(polys).toHaveCount(2);
    await page.locator('[data-slot="chart-legend-item"]', { hasText: 'Product B' }).click();
    await expect(polys).toHaveCount(1);
});

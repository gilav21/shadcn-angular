import { test, expect } from '@playwright/test';

test('heatmap renders one cell per data point', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('rect[data-slot="heatmap-cell"]')).toHaveCount(6);
});

test('heatmap shows a tooltip on cell hover', async ({ page }) => {
    await page.goto('/');
    await page.locator('rect[data-slot="heatmap-cell"]').first().hover();
    await expect(page.locator('[data-slot="chart-tooltip"]')).toBeVisible();
});

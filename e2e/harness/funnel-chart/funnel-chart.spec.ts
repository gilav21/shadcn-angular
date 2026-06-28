import { test, expect } from '@playwright/test';

test('funnel-chart renders one stage per data point', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('polygon[data-slot="funnel-stage"]')).toHaveCount(4);
});

test('funnel-chart shows a tooltip on hover', async ({ page }) => {
    await page.goto('/');
    await page.locator('polygon[data-slot="funnel-stage"]').first().hover();
    await expect(page.locator('[data-slot="chart-tooltip"]')).toBeVisible();
});

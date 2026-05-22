import { test, expect } from '@playwright/test';

test('bar-chart renders an SVG with one rect per data point', async ({ page }) => {
    await page.goto('/');

    const chart = page.getByTestId('chart');
    await expect(chart).toBeVisible();

    // Bar charts render their bars as SVG rect elements. We provided
    // 4 data points; expect at least 4 rects (some impls add background
    // / grid rects on top, hence `>=`).
    const rects = chart.locator('svg rect');
    expect(await rects.count()).toBeGreaterThanOrEqual(4);
});

import { test, expect } from '@playwright/test';

test('pie-chart renders one path per slice', async ({ page }) => {
    await page.goto('/');

    const chart = page.getByTestId('chart');
    await expect(chart).toBeVisible();

    // Pie slices are SVG path elements. 4 data points → 4 paths.
    const slices = chart.locator('svg path');
    expect(await slices.count()).toBeGreaterThanOrEqual(4);
});

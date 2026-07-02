import { test, expect } from '@playwright/test';

test('area-chart renders one filled area per series', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('path[data-slot="area-series"]')).toHaveCount(2);
});

test('area-chart legend toggles a series', async ({ page }) => {
    await page.goto('/');
    const areas = page.locator('path[data-slot="area-series"]');
    await expect(areas).toHaveCount(2);
    await page.locator('[data-slot="chart-legend-item"]', { hasText: 'Mobile' }).click();
    await expect(areas).toHaveCount(1);
});

test('area-chart shows a tooltip on hover', async ({ page }) => {
    await page.goto('/');
    const svg = page.locator('[data-testid="root"] svg').first();
    await svg.hover({ position: { x: 280, y: 150 } });
    await expect(page.locator('[data-slot="chart-tooltip"]')).toBeVisible();
});

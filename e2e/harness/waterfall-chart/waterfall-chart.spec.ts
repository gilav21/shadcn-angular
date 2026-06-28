import { test, expect } from '@playwright/test';

test('waterfall-chart renders one bar per data point with connectors', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('rect[data-slot="waterfall-bar"]')).toHaveCount(4);
    await expect(page.locator('line[data-slot="waterfall-connector"]')).toHaveCount(3);
});

test('waterfall-chart shows a tooltip on hover', async ({ page }) => {
    await page.goto('/');
    const svg = page.locator('[data-testid="root"] svg').first();
    await svg.hover({ position: { x: 150, y: 200 } });
    await expect(page.locator('[data-slot="chart-tooltip"]')).toBeVisible();
});

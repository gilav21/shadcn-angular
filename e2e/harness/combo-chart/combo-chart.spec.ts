import { test, expect } from '@playwright/test';

test('combo-chart renders bars and a cumulative line', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('rect[data-slot="combo-bar"]')).toHaveCount(4);
    await expect(page.locator('path[data-slot="combo-line"]')).toHaveCount(1);
});

test('combo-chart shows a tooltip on hover', async ({ page }) => {
    await page.goto('/');
    const svg = page.locator('[data-testid="root"] svg').first();
    await svg.hover({ position: { x: 200, y: 180 } });
    await expect(page.locator('[data-slot="chart-tooltip"]')).toBeVisible();
});

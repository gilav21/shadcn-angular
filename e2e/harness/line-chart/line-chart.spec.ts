import { test, expect } from '@playwright/test';

test('line-chart renders one path per series', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('path[data-slot="line-series"]')).toHaveCount(2);
});

test('line-chart legend toggles a series off and on', async ({ page }) => {
    await page.goto('/');
    const lines = page.locator('path[data-slot="line-series"]');
    await expect(lines).toHaveCount(2);

    const costLegend = page.locator('[data-slot="chart-legend-item"]', { hasText: 'Cost' });
    await costLegend.click();
    await expect(lines).toHaveCount(1);

    await costLegend.click();
    await expect(lines).toHaveCount(2);
});

test('line-chart shows a tooltip on hover', async ({ page }) => {
    await page.goto('/');
    const svg = page.locator('[data-testid="root"] svg').first();
    await svg.hover({ position: { x: 280, y: 150 } });
    await expect(page.locator('[data-slot="chart-tooltip"]')).toBeVisible();
});

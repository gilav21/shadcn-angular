import { test, expect } from '@playwright/test';

test('bubble-chart renders one bubble per point', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('circle[data-slot="bubble-point"]')).toHaveCount(4);
});

test('bubble-chart shows a tooltip on hover', async ({ page }) => {
    await page.goto('/');
    const svg = page.locator('[data-testid="root"] svg').first();
    await svg.hover({ position: { x: 200, y: 160 } });
    await expect(page.locator('[data-slot="chart-tooltip"]')).toBeVisible();
});

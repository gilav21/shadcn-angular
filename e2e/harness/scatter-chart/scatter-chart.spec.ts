import { test, expect } from '@playwright/test';

test('scatter-chart renders one point per datum', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('circle[data-slot="scatter-point"]')).toHaveCount(5);
});

test('scatter-chart legend toggles a series', async ({ page }) => {
    await page.goto('/');
    const pts = page.locator('circle[data-slot="scatter-point"]');
    await expect(pts).toHaveCount(5);
    await page.locator('[data-slot="chart-legend-item"]', { hasText: 'Group B' }).click();
    await expect(pts).toHaveCount(3);
});

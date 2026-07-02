import { test, expect } from '@playwright/test';

test('calendar-heatmap renders one cell per day', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('rect[data-slot="calendar-day"]')).toHaveCount(6);
});

test('calendar-heatmap shows a tooltip with the date on hover', async ({ page }) => {
    await page.goto('/');
    await page.locator('rect[data-slot="calendar-day"]').first().hover();
    await expect(page.locator('[data-slot="chart-tooltip"]')).toBeVisible();
});

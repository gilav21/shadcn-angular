import { test, expect } from '@playwright/test';

test('gauge-chart renders track and value arcs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('path[data-slot="gauge-track"]')).toHaveCount(1);
    await expect(page.locator('path[data-slot="gauge-value"]')).toHaveCount(1);
});

test('gauge-chart shows the value text', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toContainText('72');
});

import { test, expect } from '@playwright/test';

test('bullet-chart renders range bands, measure, and target', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('rect[data-slot="bullet-range"]')).toHaveCount(3);
    await expect(page.locator('rect[data-slot="bullet-measure"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="bullet-target"]')).toHaveCount(1);
});

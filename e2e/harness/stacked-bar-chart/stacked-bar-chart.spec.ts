import { test, expect } from '@playwright/test';

test('stacked-bar-chart renders a rect per series segment', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    // 2 series x 3 categories = 6 stacked segments.
    expect(await root.locator('svg rect').count()).toBeGreaterThanOrEqual(6);
    await expect(root).toContainText('Q1');
});

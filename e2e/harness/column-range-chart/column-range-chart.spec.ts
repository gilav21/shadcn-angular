import { test, expect } from '@playwright/test';

test('column-range-chart renders one range column per data point', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    expect(await root.locator('svg rect').count()).toBeGreaterThanOrEqual(3);
    await expect(root).toContainText('Jan');
});

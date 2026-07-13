import { test, expect } from '@playwright/test';

test('bar-race-chart renders its frames', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    expect(await root.locator('svg rect').count()).toBeGreaterThanOrEqual(2);
    await expect(root).toContainText('Alpha');
});

import { test, expect } from '@playwright/test';

test('marquee duplicates its content for a seamless loop', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    // The track is duplicated so the scroll wraps seamlessly: 4 items -> 8 nodes.
    expect(await page.locator('[data-item]').count()).toBeGreaterThanOrEqual(8);
    await expect(root).toContainText('One');
});

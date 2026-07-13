import { test, expect } from '@playwright/test';

test('stagger-children reveals each projected child', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    const items = page.locator('[data-item]');
    await expect(items).toHaveCount(3);
    for (const item of await items.all()) {
        await expect(item).toBeVisible();
    }
});

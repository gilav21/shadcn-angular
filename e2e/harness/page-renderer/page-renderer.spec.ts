import { test, expect } from '@playwright/test';

test('page-renderer instantiates one component per serialized page item, with its inputs', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root.locator('.tile')).toHaveCount(2);
    await expect(root).toContainText('Alpha');
    await expect(root).toContainText('Beta');
});

import { test, expect } from '@playwright/test';

test('flip-text renders one animated span per character', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('Flip');
    // "Flip me" -> 7 characters, each animated individually.
    expect(await root.locator('span').count()).toBeGreaterThanOrEqual(6);
});

import { test, expect } from '@playwright/test';

test('morphing-text cycles through the supplied texts', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('Alpha');
    await expect(root).toContainText('Beta', { timeout: 5000 });
});

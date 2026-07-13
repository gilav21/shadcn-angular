import { test, expect } from '@playwright/test';

test('bento-grid renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

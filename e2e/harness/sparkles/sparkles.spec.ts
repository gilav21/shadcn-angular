import { test, expect } from '@playwright/test';

test('sparkles renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

import { test, expect } from '@playwright/test';

test('file-upload renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

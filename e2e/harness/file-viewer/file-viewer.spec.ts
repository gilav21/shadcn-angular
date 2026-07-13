import { test, expect } from '@playwright/test';

test('file-viewer renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

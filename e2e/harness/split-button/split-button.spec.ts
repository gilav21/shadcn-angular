import { test, expect } from '@playwright/test';

test('split-button renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

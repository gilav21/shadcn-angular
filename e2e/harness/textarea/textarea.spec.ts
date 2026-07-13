import { test, expect } from '@playwright/test';

test('textarea renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

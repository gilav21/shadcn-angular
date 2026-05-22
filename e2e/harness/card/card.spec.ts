import { test, expect } from '@playwright/test';

test('card renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

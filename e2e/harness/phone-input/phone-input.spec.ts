import { test, expect } from '@playwright/test';

test('phone-input renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

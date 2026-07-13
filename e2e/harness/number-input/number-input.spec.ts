import { test, expect } from '@playwright/test';

test('number-input renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

import { test, expect } from '@playwright/test';

test('typing-animation renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

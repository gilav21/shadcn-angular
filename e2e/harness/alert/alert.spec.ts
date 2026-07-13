import { test, expect } from '@playwright/test';

test('alert renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

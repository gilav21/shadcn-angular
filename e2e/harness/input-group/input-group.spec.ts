import { test, expect } from '@playwright/test';

test('input-group renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

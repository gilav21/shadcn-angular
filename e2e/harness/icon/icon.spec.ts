import { test, expect } from '@playwright/test';

test('icon renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

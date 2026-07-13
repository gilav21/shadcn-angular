import { test, expect } from '@playwright/test';

test('table renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

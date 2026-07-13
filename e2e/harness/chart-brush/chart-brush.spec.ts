import { test, expect } from '@playwright/test';

test('chart-brush renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

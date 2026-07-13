import { test, expect } from '@playwright/test';

test('native-select renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

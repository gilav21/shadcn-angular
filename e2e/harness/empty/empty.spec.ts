import { test, expect } from '@playwright/test';

test('empty renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

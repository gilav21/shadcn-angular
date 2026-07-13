import { test, expect } from '@playwright/test';

test('dock renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

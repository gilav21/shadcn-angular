import { test, expect } from '@playwright/test';

test('chip-list renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

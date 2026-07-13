import { test, expect } from '@playwright/test';

test('page-builder renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

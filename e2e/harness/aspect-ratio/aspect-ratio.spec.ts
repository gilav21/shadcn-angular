import { test, expect } from '@playwright/test';

test('aspect-ratio renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

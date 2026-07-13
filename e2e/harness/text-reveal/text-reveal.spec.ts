import { test, expect } from '@playwright/test';

test('text-reveal renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

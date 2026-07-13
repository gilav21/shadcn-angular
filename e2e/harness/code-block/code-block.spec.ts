import { test, expect } from '@playwright/test';

test('code-block renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

import { test, expect } from '@playwright/test';

test('tree-select renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

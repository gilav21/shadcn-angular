import { test, expect } from '@playwright/test';

test('skeleton renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

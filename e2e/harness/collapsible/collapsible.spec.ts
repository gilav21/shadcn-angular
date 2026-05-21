import { test, expect } from '@playwright/test';

test('collapsible: trigger toggles content visibility', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('content')).toBeHidden();

    await page.getByTestId('trigger').click();
    await expect(page.getByTestId('content')).toBeVisible();

    await page.getByTestId('trigger').click();
    await expect(page.getByTestId('content')).toBeHidden();
});

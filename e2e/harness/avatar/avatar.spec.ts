import { test, expect } from '@playwright/test';

test('avatar shows fallback when image fails to load', async ({ page }) => {
    await page.goto('/');

    // The broken image URL fails, so the fallback "CX" must render.
    await expect(page.getByTestId('fallback')).toBeVisible();
    await expect(page.getByTestId('fallback')).toContainText('CX');
});

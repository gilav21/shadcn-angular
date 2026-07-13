import { test, expect } from '@playwright/test';

test('shine-border renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

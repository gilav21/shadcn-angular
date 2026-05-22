import { test, expect } from '@playwright/test';

test('badge renders all variants', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('default')).toBeVisible();
    await expect(page.getByTestId('default')).toContainText('Default');
    await expect(page.getByTestId('destructive')).toContainText('Destructive');
    await expect(page.getByTestId('outline')).toContainText('Outline');
});

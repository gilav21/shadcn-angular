import { test, expect } from '@playwright/test';

test('drawer opens from a trigger and dismisses', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('title')).toBeHidden();

    await page.getByTestId('trigger').click();
    await expect(page.getByTestId('title')).toBeVisible();
    await expect(page.getByTestId('body')).toContainText('Drawer body');

    // Drawer typically dismisses on overlay click. Click far outside
    // the content (the overlay covers the whole viewport).
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('title')).toBeHidden();
});

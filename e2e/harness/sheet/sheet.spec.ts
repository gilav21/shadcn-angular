import { test, expect } from '@playwright/test';

test('sheet opens from a trigger and closes on Escape', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('title')).toBeHidden();

    await page.getByTestId('trigger').click();
    await expect(page.getByTestId('title')).toBeVisible();
    await expect(page.getByTestId('body')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('title')).toBeHidden();
});

import { test, expect } from '@playwright/test';

test('dialog opens on trigger and closes on Escape', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByTestId('trigger');
    await expect(trigger).toBeVisible();
    await expect(page.getByTestId('title')).toBeHidden();

    await trigger.click();
    await expect(page.getByTestId('title')).toBeVisible();
    await expect(page.getByTestId('title')).toContainText('Confirm action');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('title')).toBeHidden();
});

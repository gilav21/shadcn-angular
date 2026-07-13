import { test, expect } from '@playwright/test';

test('shortcut-bindings-dialog opens from the two-way open model and closes on Escape', async ({ page }) => {
    await page.goto('/');

    const dialog = page.locator('[data-slot="dialog-content"]').first();
    await expect(dialog).toHaveCount(0);

    await page.getByTestId('open').click();
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
});

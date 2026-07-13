import { test, expect } from '@playwright/test';

test('data-table-range-chart opens a dialog charting the supplied range', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('svg')).toHaveCount(0);

    await page.getByTestId('open').click();

    const dialog = page.locator('[data-slot="dialog-content"]').first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Selection');
    await expect(dialog.locator('svg').first()).toBeVisible();
});

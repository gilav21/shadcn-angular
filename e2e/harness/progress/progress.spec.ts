import { test, expect } from '@playwright/test';

test('progress bar reflects value via aria-valuenow', async ({ page }) => {
    await page.goto('/');

    const bar = page.getByRole('progressbar').first();
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('aria-valuenow', '25');

    await page.getByTestId('bump').click();
    await expect(bar).toHaveAttribute('aria-valuenow', '50');

    await page.getByTestId('bump').click();
    await expect(bar).toHaveAttribute('aria-valuenow', '75');
});

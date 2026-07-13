import { test, expect } from '@playwright/test';

test('chart-tooltip shows its title and rows only when visible', async ({ page }) => {
    await page.goto('/');

    const tooltip = page.locator('[data-slot="chart-tooltip"]');
    await expect(tooltip).toBeHidden();

    await page.getByTestId('show').click();

    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('March');
    await expect(tooltip).toContainText('Revenue');
    await expect(tooltip).toContainText('1,240');
});

import { test, expect } from '@playwright/test';

test('stepper renders its steps and reports a step change on trigger click', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(page.locator('[data-slot="stepper-item"]')).toHaveCount(2);
    await expect(root).toContainText('Account');
    await expect(root).toContainText('Shipping');

    await page.getByTestId('stepper-trigger-2').click();
    await expect(page.getByTestId('current')).toHaveText('1');
});

import { test, expect } from '@playwright/test';

test('tabs default to declared value and switch on trigger click', async ({ page }) => {
    await page.goto('/');

    // defaultValue="account" → account content visible, others hidden.
    await expect(page.getByTestId('content-account')).toBeVisible();
    await expect(page.getByTestId('content-password')).toBeHidden();
    await expect(page.getByTestId('content-billing')).toBeHidden();

    await page.getByTestId('trigger-password').click();
    await expect(page.getByTestId('content-password')).toBeVisible();
    await expect(page.getByTestId('content-account')).toBeHidden();
    await expect(page.getByTestId('content-billing')).toBeHidden();

    await page.getByTestId('trigger-billing').click();
    await expect(page.getByTestId('content-billing')).toBeVisible();
    await expect(page.getByTestId('content-password')).toBeHidden();
});

import { test, expect } from '@playwright/test';

test('label renders and clicking it focuses the associated input', async ({ page }) => {
    await page.goto('/');
    const label = page.getByTestId('label');
    await expect(label).toBeVisible();
    await expect(label).toContainText('Email address');

    const inputEl = page.getByTestId('input');
    await expect(inputEl).not.toBeFocused();

    await label.click();
    await expect(inputEl).toBeFocused();
});

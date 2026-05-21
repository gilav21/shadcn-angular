import { test, expect } from '@playwright/test';

test('radio-group selects one value at a time', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('picked')).toHaveText('');

    await page.getByTestId('opt-b').click();
    await expect(page.getByTestId('picked')).toHaveText('b');

    await page.getByTestId('opt-c').click();
    await expect(page.getByTestId('picked')).toHaveText('c');
});

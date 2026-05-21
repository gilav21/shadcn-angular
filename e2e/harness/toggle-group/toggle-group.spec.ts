import { test, expect } from '@playwright/test';

test('toggle-group single mode: clicking selects, clicking another swaps', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('picked')).toHaveText('');

    await page.getByTestId('item-center').click();
    await expect(page.getByTestId('picked')).toHaveText('center');

    await page.getByTestId('item-right').click();
    await expect(page.getByTestId('picked')).toHaveText('right');
});

import { test, expect } from '@playwright/test';

test('select opens, choosing an item sets value and closes', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByTestId('trigger');
    await expect(trigger).toBeVisible();
    await expect(page.getByTestId('picked')).toHaveText('');

    await trigger.click();
    await expect(page.getByTestId('item-banana')).toBeVisible();

    await page.getByTestId('item-banana').click();
    await expect(page.getByTestId('picked')).toHaveText('banana');
    await expect(page.getByTestId('item-banana')).toBeHidden();
});

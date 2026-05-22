import { test, expect } from '@playwright/test';

test('dropdown menu opens, click item fires action, menu closes', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByTestId('trigger');
    await expect(trigger).toBeVisible();
    await expect(page.getByTestId('item-profile')).toBeHidden();
    await expect(page.getByTestId('selected')).toHaveText('');

    await trigger.click();
    await expect(page.getByTestId('item-profile')).toBeVisible();
    await expect(page.getByTestId('item-settings')).toBeVisible();

    await page.getByTestId('item-settings').click();
    await expect(page.getByTestId('selected')).toHaveText('settings');
    await expect(page.getByTestId('item-profile')).toBeHidden();
});

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

// UC-1: a keyboard user opens the menu, arrows to an item and presses Enter. The
// consumer's (click) must run exactly once, the same as for a pointer.
test('dropdown menu item runs its action once on Enter from the keyboard', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open menu' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('item-profile')).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('selected')).toHaveText('settings');
    await expect(page.getByTestId('count')).toHaveText('1');
    await expect(page.getByTestId('item-profile')).toBeHidden();
});

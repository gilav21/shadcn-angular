import { test, expect } from '@playwright/test';

test('menubar: click trigger opens menu, item click fires action and closes', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('item-new')).toBeHidden();

    await page.getByTestId('trigger-file').click();
    await expect(page.getByTestId('item-new')).toBeVisible();
    await expect(page.getByTestId('item-open')).toBeVisible();

    await page.getByTestId('item-open').click();
    await expect(page.getByTestId('selected')).toHaveText('open');
    await expect(page.getByTestId('item-new')).toBeHidden();
});

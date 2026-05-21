import { test, expect } from '@playwright/test';

test('alert-dialog: confirm action runs handler and closes; cancel closes without firing', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('title')).toBeHidden();
    await expect(page.getByTestId('confirmed')).toHaveText('no');

    // Cancel path.
    await page.getByTestId('trigger').click();
    await expect(page.getByTestId('title')).toBeVisible();
    await page.getByTestId('cancel').click();
    await expect(page.getByTestId('title')).toBeHidden();
    await expect(page.getByTestId('confirmed')).toHaveText('no');

    // Confirm path.
    await page.getByTestId('trigger').click();
    await page.getByTestId('confirm').click();
    await expect(page.getByTestId('confirmed')).toHaveText('yes');
    await expect(page.getByTestId('title')).toBeHidden();
});

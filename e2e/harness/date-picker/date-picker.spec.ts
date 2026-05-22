import { test, expect } from '@playwright/test';

test('date-picker opens calendar and picks a day', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('iso')).toHaveText('');

    // The picker's host has class="contents"; the real trigger is the
    // inner button with aria-haspopup="dialog". Target it directly.
    await page.locator('button[aria-haspopup="dialog"]').click();

    // Day buttons are <ui-button>s whose accessible name is the day number.
    // The calendar grid also shows previous/next-month overflow days as
    // disabled buttons with the same name — filter to the enabled one.
    await page.locator('button[aria-label="15"]:not([disabled])').first().click();

    await expect(page.getByTestId('iso')).toHaveText(/^\d{4}-\d{2}-15$/);
});

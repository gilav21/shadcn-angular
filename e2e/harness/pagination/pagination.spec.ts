import { test, expect } from '@playwright/test';

test('pagination: clicking next advances the current page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('page')).toHaveText('1');

    // pagination-next / pagination-link both render <button>, not <a>,
    // in this library. Target by role=button + accessible name.
    const next = page.getByRole('button', { name: /next/i }).first();
    await next.click();
    await expect(page.getByTestId('page')).toHaveText('2');

    await page.getByRole('button', { name: '4' }).first().click();
    await expect(page.getByTestId('page')).toHaveText('4');
});

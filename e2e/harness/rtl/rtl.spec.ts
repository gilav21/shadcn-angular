import { test, expect } from '@playwright/test';

test('overlays render correctly inside dir="rtl"', async ({ page }) => {
    await page.goto('/');

    // Computed direction propagates from the dir="rtl" wrapper.
    const direction = await page.getByTestId('root').evaluate(
        el => getComputedStyle(el).direction,
    );
    expect(direction).toBe('rtl');

    // Dialog opens, title is visible.
    await page.getByTestId('dialog-trigger').click();
    await expect(page.getByTestId('dialog-title')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dialog-title')).toBeHidden();

    // Dropdown opens.
    await page.getByTestId('dropdown-trigger').click();
    await expect(page.getByTestId('dropdown-item')).toBeVisible();
    // Click outside to close.
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('dropdown-item')).toBeHidden();

    // Select opens.
    await page.getByTestId('select-trigger').click();
    await expect(page.getByTestId('select-item')).toBeVisible();
});

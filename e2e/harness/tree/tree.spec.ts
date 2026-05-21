import { test, expect } from '@playwright/test';

test('tree expands a parent node to reveal nested children', async ({ page }) => {
    await page.goto('/');

    // The Documents node is visible; its children should be hidden until
    // it's expanded.
    await expect(page.getByTestId('item-docs')).toBeVisible();
    await expect(page.getByTestId('item-resume')).toBeHidden();
    await expect(page.getByTestId('item-cover')).toBeHidden();

    // The tree-item's header click toggles selection, not expansion;
    // the chevron button is what actually expands. Click the first
    // <button> inside the Documents item — that's the chevron.
    await page.getByTestId('item-docs').locator('button').first().click();

    await expect(page.getByTestId('item-resume')).toBeVisible();
    await expect(page.getByTestId('item-cover')).toBeVisible();

    // Siblings of Documents remain visible the whole time.
    await expect(page.getByTestId('item-photos')).toBeVisible();
});

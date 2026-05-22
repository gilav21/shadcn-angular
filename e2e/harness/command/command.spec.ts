import { test, expect } from '@playwright/test';

test('command palette filters by typed text and selects via click', async ({ page }) => {
    await page.goto('/');

    // All three items visible initially.
    await expect(page.getByTestId('item-copy')).toBeVisible();
    await expect(page.getByTestId('item-cut')).toBeVisible();
    await expect(page.getByTestId('item-paste')).toBeVisible();

    // Type "pa" — only "Paste" should remain visible.
    const search = page.getByTestId('search').locator('input');
    await search.fill('pa');
    await expect(page.getByTestId('item-paste')).toBeVisible();
    await expect(page.getByTestId('item-copy')).toBeHidden();
    await expect(page.getByTestId('item-cut')).toBeHidden();

    // Clicking the surviving item triggers its (selected) handler.
    await page.getByTestId('item-paste').click();
    await expect(page.getByTestId('picked')).toHaveText('paste');
});

test('command palette shows empty state when nothing matches', async ({ page }) => {
    await page.goto('/');
    const search = page.getByTestId('search').locator('input');
    await search.fill('zzzzz');
    await expect(page.getByTestId('empty')).toBeVisible();
    await expect(page.getByTestId('item-copy')).toBeHidden();
});

import { test, expect } from '@playwright/test';

test('sortable: keyboard reorder moves the DOM node, not just the data', async ({ page }) => {
    await page.goto('/');

    // data-testid sits on <ui-sortable-item>, which has host class 'contents'
    // (display:contents) and is not itself focusable. The focusable element
    // is the inner [data-slot="sortable-item"] div carrying tabindex — locate
    // by position via the list-scoped data-slot query.
    const singleItems = page.getByTestId('single').locator('[data-slot="sortable-item"]');
    await expect(singleItems).toHaveCount(3);

    const before = await singleItems.allTextContents();
    expect(before.map(s => s.trim())).toEqual(['Alpha', 'Beta', 'Gamma']);

    await singleItems.nth(0).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');

    const after = await singleItems.allTextContents();
    expect(after.map(s => s.trim())).toEqual(['Beta', 'Alpha', 'Gamma']);
});

test('sortable: cross-list Tab hand-off moves the item between lists', async ({ page }) => {
    await page.goto('/');

    // Starting state — item-10 (L1) lives in the left list only.
    // testid is stable across lists (uses row.id, not a list-specific prefix),
    // so we can follow the same DOM node as it moves between containers.
    await expect(page.getByTestId('left').locator('[data-testid="item-10"]')).toHaveCount(1);
    await expect(page.getByTestId('right').locator('[data-testid="item-10"]')).toHaveCount(0);

    // Lift L1 (left list, position 0) via the inner focusable, then Tab to the right peer.
    const leftItems = page.getByTestId('left').locator('[data-slot="sortable-item"]');
    await leftItems.nth(0).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');

    await expect(page.getByTestId('left').locator('[data-testid="item-10"]')).toHaveCount(0);
    await expect(page.getByTestId('right').locator('[data-testid="item-10"]')).toHaveCount(1);
});

test('sortable: aria-live region is created on first interaction and carries pickup text', async ({ page }) => {
    await page.goto('/');

    // Focus the inner focusable, then Space to lift — triggers the aria-live announce.
    const singleItems = page.getByTestId('single').locator('[data-slot="sortable-item"]');
    await singleItems.nth(0).focus();
    await page.keyboard.press('Space');

    const region = page.locator('[data-slot="sortable-aria-live"]');
    await expect(region).toHaveCount(1);
    await expect(region).toHaveText(/Alpha picked up\. Position 1 of 3/);
});

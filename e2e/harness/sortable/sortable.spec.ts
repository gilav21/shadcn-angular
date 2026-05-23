import { test, expect } from '@playwright/test';

test('sortable: keyboard reorder moves the DOM node, not just the data', async ({ page }) => {
    await page.goto('/');

    const single = page.getByTestId('single');
    const items = single.locator('[data-slot="sortable-item"]');
    await expect(items).toHaveCount(3);

    // Read pre-reorder order.
    const before = await items.allTextContents();
    expect(before.map(s => s.trim())).toEqual(['Alpha', 'Beta', 'Gamma']);

    // Focus the first row and lift it (Space) then move it down once (ArrowDown).
    await page.getByTestId('row-1').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');

    const after = await items.allTextContents();
    expect(after.map(s => s.trim())).toEqual(['Beta', 'Alpha', 'Gamma']);
});

test('sortable: cross-list Tab hand-off moves the item between lists', async ({ page }) => {
    await page.goto('/');

    // Verify starting state (scoped to the right list — left-10 starts in the left list).
    await expect(page.getByTestId('left').locator('[data-testid="left-10"]')).toHaveCount(1);
    await expect(page.getByTestId('right').locator('[data-testid="left-10"]')).toHaveCount(0);

    // Lift L1 with Space, then Tab to hand it off to the right list.
    await page.getByTestId('left-10').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');

    // L1 should now live in the right list, no longer in the left.
    await expect(page.getByTestId('left').locator('[data-testid="left-10"]')).toHaveCount(0);
    await expect(page.getByTestId('right').locator('[data-testid="left-10"]')).toHaveCount(1);
});

test('sortable: aria-live region is created on first interaction and carries pickup text', async ({ page }) => {
    await page.goto('/');

    // Initial focus triggers the construction of the sortable's aria-live handle
    // (the region is lazy-created the first time *any* sortable mounts).
    await page.getByTestId('row-1').focus();
    await page.keyboard.press('Space');

    const region = page.locator('[data-slot="sortable-aria-live"]');
    await expect(region).toHaveCount(1);
    await expect(region).toHaveText(/Alpha picked up\. Position 1 of 3/);
});

import { test, expect } from '@playwright/test';

// Proves the addon system end-to-end in a real consumer install: the lean
// data-table base + the separately-installed `pivot` addon, wired via the
// `uiDtPivot` attribute, snap together purely through Angular DI and compute a
// pivot of the table's data.

test('renders the lean base table', async ({ page }) => {
    await page.goto('/');
    const dataRows = page.locator('ui-table-body ui-table-row').filter({ hasText: /NA|EU/ });
    await expect(dataRows).toHaveCount(4);
});

test('the pivot addon computes a pivot of the base table data via the host', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('run-pivot').click();
    // NA total = 100 + 20 (product A) + 50 (product B) = 170
    await expect(page.getByTestId('pivot-total')).toHaveText('170');
});

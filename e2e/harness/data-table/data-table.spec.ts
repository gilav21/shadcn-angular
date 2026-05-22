import { test, expect } from '@playwright/test';

test('data-table renders rows and sorts on column header click', async ({ page }) => {
    await page.goto('/');

    // The table doesn't use native <table>/<tr>; it uses ui-table-* with
    // flex layout and role="rowgroup"/role="row" on the host elements.
    // Scope to the body and read row text in DOM order.
    // data-table renders an extra utility row inside the body (the no-results
    // placeholder, hidden when there are rows). Filter to rows that actually
    // contain a known data-row name to ignore it.
    const dataRows = page.locator('ui-table-body ui-table-row')
        .filter({ hasText: /Alice|Bob|Charlie/ });
    await expect(dataRows).toHaveCount(3);
    await expect(dataRows.first()).toContainText('Charlie');

    // Sort by Name (ascending).
    // The sortable header renders a ui-button inside the columnheader.
    // Targeting the button directly is reliable; its accessible name is
    // "Name, not sorted. Activate to sort ascending." etc.
    await page.getByRole('columnheader').filter({ hasText: 'Name' })
        .getByRole('button').first().click();
    await expect(dataRows.first()).toContainText('Alice');

    // Sort by Name again (descending).
    // The sortable header renders a ui-button inside the columnheader.
    // Targeting the button directly is reliable; its accessible name is
    // "Name, not sorted. Activate to sort ascending." etc.
    await page.getByRole('columnheader').filter({ hasText: 'Name' })
        .getByRole('button').first().click();
    await expect(dataRows.first()).toContainText('Charlie');
});

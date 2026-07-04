import { test, expect } from '@playwright/test';

// Proves the addon system end-to-end in a real consumer install: the lean
// data-table base + the separately-installed `export` addon (which carries the
// xlsx dependency), wired via the `uiDtExport` attribute, snap together purely
// through Angular DI and produce a downloadable file.

test('renders the lean base table', async ({ page }) => {
    await page.goto('/');

    const dataRows = page.locator('ui-table-body ui-table-row')
        .filter({ hasText: /Alice|Bob|Charlie/ });
    await expect(dataRows).toHaveCount(3);
});

test('the export addon downloads a CSV of the table rows', async ({ page }) => {
    await page.goto('/');

    // The base ships NO export code; the download only happens because the addon
    // read the rows through DataTableAddonHost and built the file itself.
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-csv').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('rows.csv');
});

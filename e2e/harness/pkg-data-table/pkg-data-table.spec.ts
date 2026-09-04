import { test, expect, type Page } from '@playwright/test';

/**
 * T-20 / UC-9 — the compiled `@gilav21/shadcn-angular-data-table` tarball,
 * installed into a pristine Angular app with NO shadcn-angular CLI
 * involvement. The union of the three addon harnesses' assertions, so a
 * behavioural difference between the copy model and the package shows up here.
 *
 * The orchestrator has already run a PRODUCTION `ng build` before serving
 * (T-22): the three addon directives reach the table purely through Angular DI,
 * which is exactly the wiring an over-eager tree-shake would sever.
 */

function trackPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    return errors;
}

test('the package table renders its three data rows', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/');

    const dataRows = page.locator('ui-table-body ui-table-row')
        .filter({ hasText: /Alice|Bob|Charlie/ });
    await expect(dataRows).toHaveCount(3);

    expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([]);
});

test('Tailwind generated the package styles (computed layout, not a class string)', async ({ page }) => {
    await page.goto('/');

    // Guards the `@source` line: without it Tailwind never scans node_modules,
    // no utilities are generated, and the table renders unstyled. The class
    // attribute is present either way, so assert the computed result instead.
    const table = page.locator('[data-testid="table"]').first();
    await expect(table).toBeVisible();
    await expect(table).not.toHaveCSS('display', 'inline');
});

test('the context-menu addon renders the row-action button and fires an action', async ({ page }) => {
    await page.goto('/');

    // The base ships no context-menu code; this button exists only because the
    // addon registered a cell-action slot through DataTableAddonHost.
    await page.getByRole('button', { name: 'Row actions' }).first().click();

    const menu = page.locator('[data-slot="context-menu-content"]');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Edit row');
    await expect(menu).toContainText('Delete row');

    await menu.locator('[data-slot="context-menu-item"]').filter({ hasText: 'Edit row' }).click();
    await expect(page.getByTestId('last-action')).toHaveText(/^edit:/);
});

test('the export addon downloads a CSV of the table rows', async ({ page }) => {
    await page.goto('/');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-csv').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('rows.csv');
});

test('the pivot addon aggregates through the host contract', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/');

    // Team A = Alice (50) + Charlie (70). The base ships no pivot code, so a
    // correct total proves the addon read the rows via DataTableAddonHost.
    await page.getByTestId('run-pivot').click();
    await expect(page.getByTestId('pivot-total')).toHaveText('120');

    expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([]);
});

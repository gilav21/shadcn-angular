import { test, expect } from '@playwright/test';

// Proves the addon system end-to-end in a real consumer install: the lean
// data-table base + the separately-installed `context-menu` addon, wired via
// the `uiDtContextMenu` attribute, snap together purely through Angular DI.

test('addon contributes the ⋮ row-action button to the lean base via the host slot', async ({ page }) => {
    await page.goto('/');

    const dataRows = page.locator('ui-table-body ui-table-row')
        .filter({ hasText: /Alice|Bob|Charlie/ });
    await expect(dataRows).toHaveCount(3);

    // The base ships NO context-menu code; the ⋮ button only exists because the
    // addon registered a cell-action slot through DataTableAddonHost.
    const rowActionButtons = page.getByRole('button', { name: 'Row actions' });
    await expect(rowActionButtons.first()).toBeVisible();
});

test('clicking the ⋮ button opens the addon-rendered menu and fires the action', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Row actions' }).first().click();

    const menu = page.locator('[data-slot="context-menu-content"]');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Edit row');
    await expect(menu).toContainText('Delete row');

    await menu.locator('[data-slot="context-menu-item"]').filter({ hasText: 'Edit row' }).click();
    await expect(menu).toBeHidden();
});

test('right-clicking a row opens the row context menu', async ({ page }) => {
    await page.goto('/');

    const firstRow = page.locator('ui-table-body ui-table-row')
        .filter({ hasText: /Alice|Bob|Charlie/ }).first();
    await firstRow.click({ button: 'right' });

    const menu = page.locator('[data-slot="context-menu-content"]');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Edit row');
});

test('custom mode: a right-click on a row opens the bound menu and reports the row', async ({ page }) => {
    await page.goto('/');

    const table = page.getByTestId('custom-table');
    await table.getByText('Beta').click({ button: 'right' });

    const menu = page.locator('[data-slot="context-menu-content"]');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Rename');
    await expect(menu).toContainText('Archive');
    await expect(page.getByTestId('custom-row')).toHaveText('Beta');
});

test('custom mode: a header right-click reports the header, not a row', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('custom-table').getByText('Label').first().click({ button: 'right' });

    await expect(page.locator('[data-slot="context-menu-content"]')).toBeVisible();
    await expect(page.getByTestId('custom-header')).toHaveText('Label');
    await expect(page.getByTestId('custom-row')).toHaveText('');
});

test('both inputs: the bound menu owns the right-click and the ⋮ button still opens the built menu', async ({ page }) => {
    await page.goto('/');

    const table = page.getByTestId('custom-table');
    await table.getByText('Alpha').click({ button: 'right' });
    const menu = page.locator('[data-slot="context-menu-content"]');
    await expect(menu).toContainText('Rename');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    await table.getByRole('button', { name: 'Row actions' }).first().click();
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Pin row');
    await expect(menu).not.toContainText('Rename');
});

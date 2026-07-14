import { test, expect } from '@playwright/test';

// Proves the rich-text tables addon end-to-end in a real consumer install: the
// editor base + the separately-installed `tables` addon snap together through
// Angular DI (a component toolbar slot inserting through the insertHtmlAtCaret
// host seam). That the harness compiles at all proves the addon builds under AOT
// in a plain consumer app (no workspace dedup) with its own `popover` dependency.

test('the addon contributes the table button to the base toolbar', async ({ page }) => {
    await page.goto('/');

    // The base editor ships NO table-insert UI; the button exists only because
    // the addon registered a component slot through the host.
    const editor = page.locator('[data-testid="editor"]');
    await expect(editor.locator('[data-addon-slot="tables.insert"] button[title="Insert Table"]')).toBeVisible();

    // The editor without the directive gets no table button.
    const plain = page.locator('[data-testid="editor-plain"]');
    await expect(plain.locator('[data-addon-slot="tables.insert"]')).toHaveCount(0);
});

test('selecting a grid size inserts a table with the right rows and columns', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    const editable = editor.locator('[data-slot="rich-text-editor"]');

    // Place the caret in the paragraph so the table inserts at a selection.
    await editable.locator('p').click();

    const slot = editor.locator('[data-addon-slot="tables.insert"]');
    await slot.locator('button[title="Insert Table"]').click();

    // Pick a 3×4 table from the grid picker (aria-label is `<row>x<col>`).
    await slot.locator('[data-grid-cell][aria-label="3x4"]').click();

    const table = editable.locator('table');
    await expect(table).toHaveCount(1);
    await expect(table.locator('thead tr th')).toHaveCount(4);
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('[data-testid="last-insert"]')).toHaveText('3x4');
});

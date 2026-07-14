import { test, expect } from '@playwright/test';

// Proves the rich-text history addon end-to-end in a real consumer install: the
// editor base + the separately-installed `history` addon snap together through
// Angular DI. That the harness compiles at all proves the addon builds under
// AOT in a plain consumer app (no workspace dedup), and that the base sheds the
// `dialog` dependency without breaking the editor.

// The corner button exposes an aria-label (Open revision history …); its visible
// text is "History (N)". Match on the aria-label, which is its accessible name.
const OPEN_HISTORY = /Open revision history/;

test('the corner "Revisions" button appears only on the addon editor', async ({ page }) => {
    await page.goto('/');

    await expect(
        page.locator('[data-testid="editor"] ui-rich-text-history-panel').getByRole('button', { name: OPEN_HISTORY }),
    ).toBeVisible();

    await expect(page.locator('[data-testid="editor-plain"] ui-rich-text-history-panel')).toHaveCount(0);
});

test('typing builds revisions and restoring an earlier one reverts the content', async ({ page }) => {
    await page.goto('/');

    const editable = page.locator('[data-testid="editor"] [data-slot="rich-text-editor"]');
    await editable.locator('p').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' second');
    // Let the debounced snapshot land, then add more so there is an earlier entry.
    await page.waitForTimeout(300);
    await page.keyboard.type(' third');
    await page.waitForTimeout(300);

    await expect(editable).toContainText('first second third');

    await page.locator('[data-testid="editor"] ui-rich-text-history-panel')
        .getByRole('button', { name: OPEN_HISTORY })
        .click();

    const rows = page.locator('[data-history-list="popover"] [data-history-entry-action="true"]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(1);

    // Rows render newest-first; click the last (earliest) to restore.
    await rows.last().click();

    await expect(editable).not.toContainText('third');
});

test('the preview dialog opens and shows a rendered snapshot', async ({ page }) => {
    await page.goto('/');

    const editable = page.locator('[data-testid="editor"] [data-slot="rich-text-editor"]');
    await editable.locator('p').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' more');
    await page.waitForTimeout(300);

    await page.locator('[data-testid="editor"] ui-rich-text-history-panel')
        .getByRole('button', { name: OPEN_HISTORY })
        .click();

    await page.locator('[data-history-list="popover"] [data-history-entry-action="true"]')
        .first()
        .getByRole('button', { name: /Preview/ })
        .click();

    const dialog = page.locator('[data-slot="dialog-content"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Rendered Preview');
});

import { test, expect } from '@playwright/test';

// Proves the rich-text outline addon end-to-end in a real consumer install: the
// editor base + the separately-installed `outline` addon snap together through
// Angular DI (a toolbar button slot + an overlay-anchored docked panel). That
// the harness compiles and the panel renders proves the addon builds under AOT
// in a plain consumer app (no workspace dedup) and that the base no longer ships
// the outline UI or its scroll-area dependency.

test('the addon contributes the outline button only on the addon editor', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    await expect(editor.locator('[data-addon-slot="view.outline"]')).toBeVisible();

    const plain = page.locator('[data-testid="editor-plain"]');
    await expect(plain.locator('[data-addon-slot="view.outline"]')).toHaveCount(0);
    await expect(plain.locator('[data-slot="rich-text-outline-panel"]')).toHaveCount(0);
});

test('clicking the outline button opens a docked panel listing the headings', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    await expect(editor.locator('[data-slot="rich-text-outline-panel"]')).toHaveCount(0);

    await editor.locator('[data-addon-slot="view.outline"]').click();

    const panel = editor.locator('[data-slot="rich-text-outline-panel"]');
    await expect(panel).toBeVisible();

    const entries = panel.locator('[data-outline-entry]');
    await expect(entries).toHaveCount(4);
    await expect(entries.first()).toHaveText('Getting started');
});

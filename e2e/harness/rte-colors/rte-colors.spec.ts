import { test, expect } from '@playwright/test';

// Proves the rich-text colours addon end-to-end in a real consumer install: the
// editor base + the separately-installed `colors` addon snap together through
// Angular DI (two component toolbar slots). That the harness compiles at all
// proves the addon builds under AOT in a plain consumer app (no workspace
// dedup) with its own `color-picker` dependency.

test('the addon contributes the text- and highlight-colour buttons to the base toolbar', async ({ page }) => {
    await page.goto('/');

    // The base editor ships NO colour code; these buttons exist only because the
    // addon registered two component slots through RichTextEditorAddonHost.
    const editor = page.locator('[data-testid="editor"]');
    await expect(editor.locator('[data-addon-slot="colors.foreground"] button[title="Text Color"]')).toBeVisible();
    await expect(editor.locator('[data-addon-slot="colors.background"] button[title="Background Color"]')).toBeVisible();

    // The editor without the directive gets no colour buttons.
    const plain = page.locator('[data-testid="editor-plain"]');
    await expect(plain.locator('[data-addon-slot="colors.foreground"]')).toHaveCount(0);
    await expect(plain.locator('[data-addon-slot="colors.background"]')).toHaveCount(0);
});

test('picking a text colour applies an inline colour style to the selection', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    const editable = editor.locator('[data-slot="rich-text-editor"]');

    // Select the paragraph so the colour command has a target.
    await editable.locator('p').click({ clickCount: 3 });

    await editor.locator('[data-addon-slot="colors.foreground"] button').click();
    const picker = editor.locator('[data-addon-slot="colors.foreground"] ui-color-picker');
    await expect(picker).toBeVisible();

    await picker.locator('button[data-color-btn][aria-label="Select #ff0000"]').click();

    await expect(editable.locator('[style*="color"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="editor-html"]')).toContainText('rgb(255, 0, 0)');
    await expect(page.locator('[data-testid="last-color"]')).toContainText('fontColor:#ff0000');
});

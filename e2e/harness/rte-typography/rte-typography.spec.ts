import { test, expect } from '@playwright/test';

// Proves the rich-text typography addon end-to-end in a real consumer install:
// the editor base + the separately-installed `typography` addon snap together
// through Angular DI (two component toolbar slots). That the harness compiles at
// all proves the addon builds under AOT in a plain consumer app (no workspace
// dedup) with its own `autocomplete` dependency.

test('the addon contributes the font-size and font-family buttons to the base toolbar', async ({ page }) => {
    await page.goto('/');

    // The base editor ships NO font-size/font-family code; these buttons exist
    // only because the addon registered two component slots through the host.
    const editor = page.locator('[data-testid="editor"]');
    await expect(editor.locator('[data-addon-slot="typography.size"] button[title="Font Size"]')).toBeVisible();
    await expect(editor.locator('[data-addon-slot="typography.family"] button[title="Font Family"]')).toBeVisible();

    // The editor without the directive gets no font buttons.
    const plain = page.locator('[data-testid="editor-plain"]');
    await expect(plain.locator('[data-addon-slot="typography.size"]')).toHaveCount(0);
    await expect(plain.locator('[data-addon-slot="typography.family"]')).toHaveCount(0);
});

test('picking a font size applies an inline font-size style to the selection', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    const editable = editor.locator('[data-slot="rich-text-editor"]');

    // Select the paragraph so the font command has a target.
    await editable.locator('p').click({ clickCount: 3 });

    const sizeSlot = editor.locator('[data-addon-slot="typography.size"]');
    await sizeSlot.locator('button').first().click();
    const auto = sizeSlot.locator('ui-autocomplete');
    await expect(auto).toBeVisible();

    await auto.locator('input[role="combobox"]').click();
    await sizeSlot.locator('ui-command-item', { hasText: '24px' }).first().click();

    await expect(editable.locator('[style*="font-size"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="editor-html"]')).toContainText('font-size: 24px');
    await expect(page.locator('[data-testid="last-size"]')).toHaveText('24');
});

test('picking a font family applies an inline font-family style to the selection', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    const editable = editor.locator('[data-slot="rich-text-editor"]');

    await editable.locator('p').click({ clickCount: 3 });

    const familySlot = editor.locator('[data-addon-slot="typography.family"]');
    await familySlot.locator('button').first().click();
    const auto = familySlot.locator('ui-autocomplete');
    await expect(auto).toBeVisible();

    await auto.locator('input[role="combobox"]').click();
    await familySlot.locator('ui-command-item', { hasText: 'Georgia' }).first().click();

    await expect(editable.locator('[style*="font-family"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="editor-html"]')).toContainText('Georgia');
    await expect(page.locator('[data-testid="last-family"]')).toHaveText('Georgia');
});

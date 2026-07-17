import { test, expect } from '@playwright/test';

// Proves the rich-text emoji addon end-to-end in a real consumer install: the
// editor base + the separately-installed `emoji` addon snap together through
// Angular DI (component toolbar slot). That the harness compiles at all proves
// the addon builds under AOT in a plain consumer app (no workspace dedup).

test('the addon contributes the emoji picker button to the base editor toolbar', async ({ page }) => {
    await page.goto('/');

    // The base editor ships NO emoji code; this button exists only because the
    // addon registered a component slot through RichTextEditorAddonHost.
    const slot = page.locator('[data-testid="editor"] [data-addon-slot="emoji.insert"]');
    await expect(slot.locator('button[title="Insert Emoji"]')).toBeVisible();

    // The editor without the directive gets no emoji button.
    await expect(page.locator('[data-testid="editor-plain"] [data-addon-slot="emoji.insert"]')).toHaveCount(0);
});

test('picking an emoji inserts it into the content and emits emojiInsert', async ({ page }) => {
    await page.goto('/');

    const editable = page.locator('[data-testid="editor"] [data-slot="rich-text-editor"]');
    await editable.locator('p').click();

    await page.locator('[data-testid="editor"] [data-addon-slot="emoji.insert"] button').click();
    const picker = page.locator('[data-slot="emoji-picker-content"]');
    await expect(picker).toBeVisible();

    // Scope to a grid section — the category nav uses the same emoji as its icon.
    await picker.locator('[data-category] button', { hasText: '😀' }).first().click();

    await expect(editable).toContainText('😀');
    await expect(page.locator('[data-testid="last-emoji"]')).toContainText('😀');
    await expect(page.locator('[data-testid="editor-html"]')).toContainText('😀');
});

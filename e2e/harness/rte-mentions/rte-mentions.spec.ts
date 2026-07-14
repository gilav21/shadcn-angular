import { test, expect } from '@playwright/test';

// Proves the rich-text mentions addon end-to-end in a real consumer install: the
// editor base + the separately-installed `mentions` addon snap together through
// Angular DI. The addon detects the `@` trigger at the caret via the
// registerInputObserver seam, renders the candidate popover, and inserts a
// `[data-mention]` chip through the mutateContent host seam. That the harness
// compiles at all proves the addon builds under AOT in a plain consumer app.

test('typing "@" opens the candidate popover only on the addon editor', async ({ page }) => {
    await page.goto('/');

    const editable = page.locator('[data-testid="editor"] [data-slot="rich-text-editor"]');
    await editable.click();
    await editable.pressSequentially('@john');

    // The addon renders its popover as a listbox.
    await expect(page.locator('[role="listbox"] [role="option"]').first()).toBeVisible();

    // The plain editor (no directive) never opens a popover.
    const plain = page.locator('[data-testid="editor-plain"] [data-slot="rich-text-editor"]');
    await plain.click();
    await plain.pressSequentially('@john');
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);
});

test('selecting a candidate inserts a mention chip into the content', async ({ page }) => {
    await page.goto('/');

    const editorRoot = page.locator('[data-testid="editor"]');
    const editable = editorRoot.locator('[data-slot="rich-text-editor"]');
    await editable.click();
    await editable.pressSequentially('@john');

    await page.locator('[role="listbox"] [role="option"]').first().click();

    await expect(editable.locator('[data-mention]')).toHaveCount(1);
    await expect(editable.locator('[data-mention]')).toHaveText('@John Doe');
    await expect(page.locator('[data-testid="last-insert"]')).toHaveText('John Doe');
});

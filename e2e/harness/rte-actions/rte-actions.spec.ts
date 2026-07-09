import { test, expect, type Page } from '@playwright/test';

// Proves the rich-text-actions addon system end-to-end in a real consumer
// install: the editor base + the separately-installed `actions` addon + dialog,
// wired via `uiRteActions` / `uiRichTextActions`, snap together through Angular
// DI. That the harness compiles at all proves the addon builds under AOT in a
// plain consumer app (no workspace dedup).

/**
 * Selects the demo paragraph in the "combined action" editor and attaches
 * `linkedPreviewDialogAction()` (id `preset.linked-preview-dialog`) to it via
 * the toolbar's "Attach action" flow, filling only the required `body` field.
 */
async function attachCombinedAction(page: Page): Promise<void> {
    const editable = page.locator('[data-testid="editor-combined"] [data-slot="rich-text-editor"]');
    await editable.locator('p').click({ clickCount: 3 });

    await page.locator('[data-testid="editor-combined"] [data-addon-slot="actions.attach"]').click();
    await page.locator('[data-action-option="preset.linked-preview-dialog"]').click();
    await page.locator('[data-field="title"]').fill('Idempotent');
    await page.locator('[data-field="body"]').fill('Calling it once or many times has the same effect.');
    await page.locator('[data-testid="rta-confirm"]').click();

    await expect(page.locator('[data-slot="rich-text-actions-dialog"]')).toBeHidden();
}

test('the addon contributes the "Attach action" toolbar button to the base editor', async ({ page }) => {
    await page.goto('/');

    // The base editor ships NO action code; this button exists only because the
    // addon registered a toolbar slot through RichTextEditorAddonHost. Scoped to
    // the first editor — the "combined action" editor further down contributes
    // its own instance of the same slot.
    const attachButton = page.locator('[data-testid="editor"] [data-addon-slot="actions.attach"]');
    await expect(attachButton).toBeVisible();
});

test('clicking a published action fires the dev callback and opens a real dialog', async ({ page }) => {
    await page.goto('/');

    const dialog = page.locator('[data-testid="opened-dialog"]');
    await expect(dialog).toBeHidden();

    // The framework-free runtime delivers the click to the handler, which opens
    // the consumer's ui-dialog with the action's params.
    await page.locator('[data-testid="published"] [data-action-click="open-dialog"]').click();

    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('pricing');
});

test('the published action element carries only inert data-action attributes', async ({ page }) => {
    await page.goto('/');

    const actioned = page.locator('[data-testid="published"] [data-action-click]');
    await expect(actioned).toHaveAttribute('data-action-click', 'open-dialog');
    await expect(actioned).toHaveAttribute('data-action-click-params', '{"dialogId":"pricing"}');
    // No script/handler leaked into the serialized HTML.
    await expect(actioned).not.toHaveAttribute('onclick', /.*/);
});

// Test 84: author attaches the `linkedPreviewDialogAction()` combined preset via
// the toolbar; on the published pane, hovering the run shows a preview card and
// clicking it opens a dialog — both wired from the single attach. Hover and click
// are exercised in separate tests (each on a fresh page) so Playwright's own
// mouse-move-then-click sequence can't re-trigger the hover preview mid-click.
test('the combined preset action: hovering the published run shows a preview card', async ({ page }) => {
    await page.goto('/');
    await attachCombinedAction(page);

    const published = page.locator('[data-testid="published-combined"] [data-action-click][data-action-hover]');
    await expect(published).toHaveAttribute('data-action-click', 'preset.linked-preview-dialog');
    await expect(published).toHaveAttribute('data-action-hover', 'preset.linked-preview-dialog');

    await published.hover();
    const previewCard = page.locator('[data-slot="preset-hover-card"]');
    await expect(previewCard).toBeVisible();
    await expect(previewCard).toContainText('Calling it once or many times has the same effect.');
});

test('the combined preset action: clicking the published run opens a dialog', async ({ page }) => {
    await page.goto('/');
    await attachCombinedAction(page);

    const published = page.locator('[data-testid="published-combined"] [data-action-click][data-action-hover]');
    await published.click();

    const dialog = page.locator('[data-slot="preset-dialog"] [role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Idempotent');
});

// Test 85: the seeded `uiRteActionsStyle` writes an inline `style` on the newly
// created span in the editor's emitted HTML, and that style survives the
// round trip through the sanitizer into the rendered published pane.
test('the seeded starter style is present in the emitted HTML and survives the round trip', async ({ page }) => {
    await page.goto('/');
    await attachCombinedAction(page);

    const emittedHtmlLocator = page.locator('[data-testid="editor-combined-html"]');
    await expect(emittedHtmlLocator).toContainText('data-action-click="preset.linked-preview-dialog"');
    const emittedHtml = await emittedHtmlLocator.textContent();
    expect(emittedHtml ?? '').toMatch(/data-action-click="preset\.linked-preview-dialog"[^>]*style="/);

    const publishedSpan = page.locator('[data-testid="published-combined"] [data-action-click]');
    const publishedStyle = await publishedSpan.getAttribute('style');
    expect(publishedStyle ?? '').toContain('color');
});

import { test, expect } from '@playwright/test';

// Proves the rich-text-actions addon system end-to-end in a real consumer
// install: the editor base + the separately-installed `actions` addon + dialog,
// wired via `uiRteActions` / `uiRichTextActions`, snap together through Angular
// DI. That the harness compiles at all proves the addon builds under AOT in a
// plain consumer app (no workspace dedup).

test('the addon contributes the "Attach action" toolbar button to the base editor', async ({ page }) => {
    await page.goto('/');

    // The base editor ships NO action code; this button exists only because the
    // addon registered a toolbar slot through RichTextEditorAddonHost.
    const attachButton = page.locator('[data-addon-slot="actions.attach"]');
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

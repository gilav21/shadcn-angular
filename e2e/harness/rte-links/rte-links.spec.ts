import { test, expect } from '@playwright/test';

// Proves the rich-text links addon end-to-end in a real consumer install: the
// editor base + the separately-installed `links` addon snap together through
// Angular DI (a component toolbar slot + the showLinkDialog delegation seam).
// That the harness compiles at all proves the addon builds under AOT in a plain
// consumer app (no workspace dedup) with its own `popover` dependency.

test('the addon contributes the link button to the base toolbar', async ({ page }) => {
    await page.goto('/');

    // The base editor ships NO link UI; the button exists only because the addon
    // registered a component slot through the host.
    const editor = page.locator('[data-testid="editor"]');
    await expect(editor.locator('[data-addon-slot="links.insert"] button[title="Insert Link"]')).toBeVisible();

    // The editor without the directive gets no link button.
    const plain = page.locator('[data-testid="editor-plain"]');
    await expect(plain.locator('[data-addon-slot="links.insert"]')).toHaveCount(0);
});

test('inserting a link through the toolbar popover wraps the selection in an anchor', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    const editable = editor.locator('[data-slot="rich-text-editor"]');

    // Select the paragraph so the link has a target.
    await editable.locator('p').click({ clickCount: 3 });

    const slot = editor.locator('[data-addon-slot="links.insert"]');
    await slot.locator('button[title="Insert Link"]').click();

    const form = page.locator('ui-rich-text-links-form');
    await expect(form).toBeVisible();
    await form.locator('input[type="url"]').fill('https://playwright.dev');
    await form.getByRole('button', { name: 'Insert Link' }).click();

    await expect(editable.locator('a[href="https://playwright.dev"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="editor-html"]')).toContainText('https://playwright.dev');
    await expect(page.locator('[data-testid="last-insert"]')).toHaveText('https://playwright.dev');
});

test('clicking an existing link opens the edit popover and removes it', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    const editable = editor.locator('[data-slot="rich-text-editor"]');

    // Insert a link first.
    await editable.locator('p').click({ clickCount: 3 });
    const slot = editor.locator('[data-addon-slot="links.insert"]');
    await slot.locator('button[title="Insert Link"]').click();
    const insertForm = page.locator('ui-rich-text-links-form');
    await insertForm.locator('input[type="url"]').fill('https://example.com');
    await insertForm.getByRole('button', { name: 'Insert Link' }).click();
    await expect(editable.locator('a[href="https://example.com"]')).toHaveCount(1);

    // Click into the link — the edit popover (with Remove) opens.
    await editable.locator('a').click();
    const editForm = page.locator('ui-rich-text-links-form');
    await expect(editForm).toBeVisible();
    await editForm.getByRole('button', { name: 'Remove' }).click();

    await expect(editable.locator('a')).toHaveCount(0);
    await expect(page.locator('[data-testid="last-remove"]')).toHaveText('https://example.com');
});

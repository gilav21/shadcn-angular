import { test, expect } from '@playwright/test';

// Proves the rich-text images addon end-to-end in a real consumer install: the
// editor base + the separately-installed `images` addon snap together through
// Angular DI (a component toolbar slot inserting through the mutateContent host
// seam). That the harness compiles at all proves the addon builds under AOT in a
// plain consumer app (no workspace dedup) with its own `button` + `popover`
// dependencies.

test('the addon contributes the image button to the base toolbar', async ({ page }) => {
    await page.goto('/');

    // The base editor ships NO image UI; the button exists only because the
    // addon registered a component slot through the host.
    const editor = page.locator('[data-testid="editor"]');
    await expect(editor.locator('[data-addon-slot="images.insert"] [data-slot="rte-images-button"]')).toBeVisible();

    // The editor without the directive gets no image button.
    const plain = page.locator('[data-testid="editor-plain"]');
    await expect(plain.locator('[data-addon-slot="images.insert"]')).toHaveCount(0);
});

test('inserting a URL through the popover adds an image to the content', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    const editable = editor.locator('[data-slot="rich-text-editor"]');

    // Place the caret in the paragraph so the image inserts at a selection.
    await editable.locator('p').click();

    const slot = editor.locator('[data-addon-slot="images.insert"]');
    await slot.locator('[data-slot="rte-images-button"]').click();

    await page.locator('[data-slot="rte-images-url"]').fill('https://cdn.example.com/pic.png');
    await page.locator('[data-slot="rte-images-insert"]').click();

    await expect(editable.locator('img')).toHaveCount(1);
    await expect(editable.locator('img')).toHaveAttribute('src', 'https://cdn.example.com/pic.png');
});

test('clicking an inserted image reveals the resize overlay', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    const editable = editor.locator('[data-slot="rich-text-editor"]');

    await editable.locator('p').click();
    const slot = editor.locator('[data-addon-slot="images.insert"]');
    await slot.locator('[data-slot="rte-images-button"]').click();
    await page.locator('[data-slot="rte-images-url"]').fill('https://cdn.example.com/pic.png');
    await page.locator('[data-slot="rte-images-insert"]').click();

    // Selecting the image mounts the resize/align overlay (delete button title).
    await editable.locator('img').click();
    await expect(editor.locator('button[title="Delete image"]')).toBeVisible();
});

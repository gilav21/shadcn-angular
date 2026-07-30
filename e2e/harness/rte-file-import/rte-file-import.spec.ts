import { test, expect } from '@playwright/test';

// Proves the rich-text file-import addon end-to-end in a real consumer install:
// the editor base + the separately-installed `file-import` addon snap together
// through Angular DI (a component toolbar slot). That the harness compiles and
// the button renders proves the addon builds under AOT in a plain consumer app
// (no workspace dedup) and that the base no longer ships the import UI.

test('the addon contributes the import button to the base toolbar', async ({ page }) => {
    await page.goto('/');

    // The base editor ships NO import UI; the button exists only because the
    // addon registered a component slot through the host.
    const editor = page.locator('[data-testid="editor"]');
    await expect(
        editor.locator('[data-addon-slot="file-import.import"] [data-slot="rte-file-import-button"]'),
    ).toBeVisible();

    // The editor without the directive gets no import button.
    const plain = page.locator('[data-testid="editor-plain"]');
    await expect(plain.locator('[data-addon-slot="file-import.import"]')).toHaveCount(0);
});

// Without the images addon there is no image pipeline to route a picked image
// into, so the picker offers documents only.
test('the addon wires a hidden .pdf/.docx file picker behind the button', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    const input = editor.locator('[data-slot="rte-file-import-input"]');
    await expect(input).toHaveCount(1);
    await expect(input).toHaveAttribute('accept', '.pdf,.docx');
});

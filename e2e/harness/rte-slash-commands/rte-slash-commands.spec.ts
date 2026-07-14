import { test, expect } from '@playwright/test';

// Proves the rich-text slash-commands addon end-to-end in a real consumer
// install: the editor base + the separately-installed `slash-commands` addon
// snap together through Angular DI. That the harness compiles at all proves the
// addon builds under AOT in a plain consumer app (no workspace dedup).

test('typing "/" opens the command menu and Enter applies a block transform', async ({ page }) => {
    await page.goto('/');

    const editable = page.locator('[data-testid="editor"] [data-slot="rich-text-editor"]');
    await editable.locator('p').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' /h1');

    const menu = page.locator('[data-slot="rich-text-slash-commands-menu"]');
    await expect(menu).toBeVisible();
    await expect(menu.getByText('Heading 1')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(menu).toHaveCount(0);
    await expect(editable.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="editor-html"]')).toContainText('<h1');
});

test('a custom command from the input appears and runs', async ({ page }) => {
    await page.goto('/');

    const editable = page.locator('[data-testid="editor"] [data-slot="rich-text-editor"]');
    await editable.locator('p').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' /stamp');

    const menu = page.locator('[data-slot="rich-text-slash-commands-menu"]');
    await expect(menu.getByText('Insert Stamp')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(editable).toContainText('STAMPED');
});

test('the editor without the addon shows no menu when typing "/"', async ({ page }) => {
    await page.goto('/');

    const plain = page.locator('[data-testid="editor-plain"] [data-slot="rich-text-editor"]');
    await plain.locator('p').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' /h1');

    await expect(page.locator('[data-slot="rich-text-slash-commands-menu"]')).toHaveCount(0);
});

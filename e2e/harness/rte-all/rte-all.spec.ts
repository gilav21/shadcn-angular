import { test, expect } from '@playwright/test';

// Composition proof: the slim base + ALL THIRTEEN addons applied to one editor
// in a real consumer install. The valuable assertions here are the CROSSING
// points — slots from many addons rendering together and the slash menu
// aggregating commands registered by different addons — not any single
// feature (each has its own harness).

const ALL_SLOTS = [
    'actions.attach', 'colors.background', 'colors.foreground', 'emoji.insert',
    'file-import.import', 'images.insert', 'links.insert', 'tables.insert',
    'typography.family', 'typography.size', 'view.outline',
];

test('all toolbar addon slots render together on one editor; the control editor has none', async ({ page }) => {
    await page.goto('/');

    for (const slot of ALL_SLOTS) {
        await expect(page.locator(`[data-testid="editor-all"] [data-addon-slot="${slot}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-testid="editor-plain"] [data-addon-slot]')).toHaveCount(0);
});

test('the slash menu aggregates commands registered by different addons', async ({ page }) => {
    await page.goto('/');
    const editable = page.locator('[data-testid="editor-all"] [data-slot="rich-text-editor"]');

    // Each query below is satisfied ONLY by the named command a DIFFERENT
    // addon registered into the editor's instance command registry (none of
    // the slash addon's own defaults carry these labels).
    const crossAddonCommands: Array<[string, string]> = [
        ['link', 'Link'],
        ['ai', 'Ask AI'],
        ['outline', 'Outline'],
    ];
    for (const [query, label] of crossAddonCommands) {
        await editable.click();
        await editable.press('Control+a');
        await editable.pressSequentially(`/${query}`);
        const menu = page.locator('[data-slot="rich-text-slash-commands-menu"]');
        await expect(menu).toBeVisible();
        await expect(
            menu.locator('[data-slash-index]').filter({ has: page.getByText(label, { exact: true }) }).first(),
        ).toBeVisible();
        await editable.press('Escape');
    }
});

test('overlay features coexist: outline panel open while emoji inserts', async ({ page }) => {
    await page.goto('/');
    const editorAll = page.locator('[data-testid="editor-all"]');

    await editorAll.locator('[data-addon-slot="view.outline"]').click();
    const panel = page.locator('[data-slot="rich-text-outline-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Doc title');

    await editorAll.locator('[data-slot="rich-text-editor"] p').click();
    await editorAll.locator('[data-addon-slot="emoji.insert"] button').click();
    const picker = page.locator('[data-slot="emoji-picker-content"]');
    await expect(picker).toBeVisible();
    await picker.locator('[data-category] button', { hasText: '😀' }).first().click();

    await expect(editorAll.locator('[data-slot="rich-text-editor"]')).toContainText('😀');
    await expect(panel).toBeVisible();
});

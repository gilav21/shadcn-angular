import { test, expect, type Page } from '@playwright/test';

/**
 * T-19 / UC-8 — the compiled `@gilav21/shadcn-angular-rte` tarball, installed
 * into a pristine Angular app with NO shadcn-angular CLI involvement, renders
 * and behaves like the copy model.
 *
 * The orchestrator has already run a PRODUCTION `ng build` before serving
 * (T-22), so anything tree-shaking or AOT would break in a real consumer's
 * bundle is broken by the time these assertions run.
 */

// Same eleven slots the `rte-all` copy-model harness asserts. Kept as a literal
// rather than imported: if the package ever renders a different set than the
// copied sources, these two lists diverging is exactly the signal we want.
const ALL_SLOTS = [
    'actions.attach', 'colors.background', 'colors.foreground', 'emoji.insert',
    'file-import.import', 'images.insert', 'links.insert', 'tables.insert',
    'typography.family', 'typography.size', 'view.outline',
];

/** Collects page errors so a silent runtime failure cannot pass as a green test. */
function trackPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    return errors;
}

test('all eleven addon slots render on the package editor; the control editor has none', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/');

    for (const slot of ALL_SLOTS) {
        await expect(page.locator(`[data-testid="editor-all"] [data-addon-slot="${slot}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-testid="editor-plain"] [data-addon-slot]')).toHaveCount(0);

    expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([]);
});

test('Tailwind generated the package styles (computed layout, not a class string)', async ({ page }) => {
    await page.goto('/');

    // The risk this guards: Tailwind v4 does not scan node_modules unless the
    // consumer adds the `@source` line, and a missing one leaves the editor
    // rendering with NO utility classes generated. Asserting the class
    // attribute would pass in that broken state — the class is in the DOM
    // either way — so assert the COMPUTED style the utility should produce.
    const toolbar = page.locator('[data-testid="editor-all"] [data-slot="rich-text-toolbar"]').first();
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveCSS('display', 'flex');
});

test('typing in the package editor updates the ngModel mirror', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/');

    const editable = page.locator('[data-testid="editor-all"] [data-slot="rich-text-editor"]');
    await editable.click();
    await editable.press('Control+a');
    await editable.pressSequentially('Package round trip');

    await expect(page.locator('[data-testid="editor-all-html"]')).toContainText('Package round trip');
    expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([]);
});

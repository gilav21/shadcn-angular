import { test, expect, type Locator, type Page } from '@playwright/test';

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

test('the package stylesheet styles the editor in an app with no Tailwind (computed layout, not a class string)', async ({ page }) => {
    await page.goto('/');

    // The fixture has no Tailwind at all: `ng add` registered the package's
    // compiled styles.css and nothing else. Asserting the class attribute would
    // pass with no stylesheet — the class is in the DOM either way — so assert
    // the COMPUTED style. `ui-rich-text-toolbar` carries a host `class: 'block'`;
    // a custom element is `display: inline` by default, so `block` can only come
    // from the package's compiled utilities.
    const toolbar = page.locator('[data-testid="editor-all"] ui-rich-text-toolbar').first();
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveCSS('display', 'block');
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

test('the package stylesheet does not restyle the host app', async ({ page }) => {
    await page.goto('/');

    // A global Tailwind preflight would zero the body margin and flatten every
    // heading to `font-size: inherit`. The package ships its reset scoped to its
    // own elements, so the app's body and its own <h2> keep browser defaults.
    await expect(page.locator('body')).toHaveCSS('margin-top', '8px');
    await expect(page.getByTestId('app-heading')).toHaveCSS('font-size', '24px');
});

/**
 * The production build re-spells colour values (`0.558` → `.558`, `0.205` →
 * `20.5%`), so a token is compared by what the browser resolves it to, never by
 * its text. `raw` is a CSS colour, or `null` to read `--primary` off `el`.
 */
function resolvedColour(locator: Locator, raw: string | null = null): Promise<string> {
    return locator.evaluate((el, value) => {
        const probe = document.createElement('i');
        probe.style.color = value ?? getComputedStyle(el).getPropertyValue('--primary');
        document.body.append(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved;
    }, raw);
}

test('theme="violet" re-colours one editor and leaves the other on the global tokens', async ({ page }) => {
    await page.goto('/');

    const plain = page.getByTestId('editor-plain');
    await expect(plain).toBeVisible();
    const violet = await resolvedColour(plain, 'oklch(0.558 0.288 302.321)');
    const globalPrimary = await resolvedColour(plain, 'oklch(0.205 0 0)');
    expect(violet).not.toBe(globalPrimary);

    expect(await resolvedColour(plain)).toBe(violet);
    expect(await resolvedColour(page.getByTestId('editor-all'))).toBe(globalPrimary);
});

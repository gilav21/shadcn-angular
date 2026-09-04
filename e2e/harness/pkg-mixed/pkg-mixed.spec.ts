import { test, expect, type Page } from '@playwright/test';

/**
 * T-21 / UC-10 — a CLI-copied component and the compiled package coexist in one
 * app: both render, both work, and neither breaks the other's DI.
 *
 * The orchestrator ran `init` + `add button` (the copy model) AND installed the
 * RTE tarball into the same fixture, then built it for production. A
 * duplicate-symbol or selector collision would already have failed that build;
 * these assertions cover what a successful build cannot tell us — that both
 * implementations are actually alive at runtime.
 */

function trackPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    return errors;
}

test('the copied button and the package editor both render, with no page errors', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/');

    await expect(page.getByTestId('copied-button')).toBeVisible();
    await expect(page.getByTestId('editor')).toBeVisible();

    // A DI failure in either graph surfaces as a pageerror rather than as a
    // missing element, so an element-only assertion could pass on a broken page.
    expect(errors, `page errors: ${errors.join(' | ')}`).toEqual([]);
});

test("the copied button's click handler still fires with the package present", async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('count')).toHaveText('0');
    await page.getByTestId('copied-button').click();
    await expect(page.getByTestId('count')).toHaveText('1');
});

test('the package editor keeps its addon slots in a mixed app', async ({ page }) => {
    await page.goto('/');

    // The package's own AddonSlotRegistry must still resolve even though the
    // copied components brought a second, unrelated copy of that service.
    await expect(
        page.locator('[data-testid="editor"] [data-addon-slot="emoji.insert"]'),
    ).toBeVisible();
});

test('two independent button implementations exist on one page', async ({ page }) => {
    await page.goto('/');

    // The copied button...
    await expect(page.locator('[data-testid="copied-button"][data-slot="button"]')).toHaveCount(1);
    // ...and the package's own internal buttons inside the editor toolbar.
    const toolbarButtons = page.locator('[data-testid="editor"] [data-slot="button"]');
    expect(await toolbarButtons.count()).toBeGreaterThan(0);
});

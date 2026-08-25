import { test, expect } from '@playwright/test';

/**
 * T-16 for `result` — proves the panel installs and renders in a pristine
 * consumer app, including the two-slot projection and the polite live region.
 */

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('result renders title, description and status icon', async ({ page }) => {
    const panel = page.getByTestId('success').locator('[data-slot="result"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-slot="result-title"]')).toHaveText(
        'Payment received',
    );
    await expect(panel.locator('[data-slot="result-description"]')).toHaveText(
        'We emailed your receipt.',
    );
    await expect(panel.locator('[data-slot="result-icon"]')).toHaveAttribute(
        'data-status',
        'success',
    );
});

test('result announces politely for every status, never assertively', async ({
    page,
}) => {
    const panels = page.locator('[data-slot="result"]');
    await expect(panels).toHaveCount(3);
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
        // A native <output>, which carries role="status" implicitly. Asserting
        // an explicit role attribute would fail while the semantics are right,
        // and push the component back to <div role="status"> — which Sonar's
        // Web:S6819 flags precisely because the native element has broader
        // assistive-tech support.
        await expect(panels.nth(i)).toHaveJSProperty('tagName', 'OUTPUT');
        await expect(panels.nth(i)).toHaveAttribute('aria-live', 'polite');
    }
});

test('result gives each status its own colour', async ({ page }) => {
    const colourOf = (testId: string) =>
        page
            .getByTestId(testId)
            .locator('[data-slot="result-icon"]')
            .evaluate(el => getComputedStyle(el).color);

    const success = await colourOf('success');
    const error = await colourOf('error');
    const info = await colourOf('bare');
    expect(new Set([success, error, info]).size).toBe(3);
});

test('result renders projected actions, centred and wrapping', async ({ page }) => {
    const actions = page.getByTestId('success').locator('[data-slot="result-actions"]');
    await expect(actions).toBeVisible();
    await expect(actions.getByTestId('primary')).toBeVisible();
    await expect(actions.getByTestId('tertiary')).toBeVisible();

    const style = await actions.evaluate(el => {
        const s = getComputedStyle(el);
        return { display: s.display, justify: s.justifyContent, wrap: s.flexWrap };
    });
    expect(style).toEqual({ display: 'flex', justify: 'center', wrap: 'wrap' });
});

test('result keeps the detail slot out of the actions row', async ({ page }) => {
    const panel = page.getByTestId('error');
    await expect(panel.locator('[data-slot="result-detail"]')).toContainText('TypeError');
    await expect(
        panel.locator('[data-slot="result-actions"] [data-testid="dump"]'),
    ).toHaveCount(0);
});

test('result opts the detail out of the live region', async ({ page }) => {
    await expect(
        page.getByTestId('error').locator('[data-slot="result-detail"]'),
    ).toHaveAttribute('aria-live', 'off');
});

test('result collapses the actions row when nothing is projected', async ({ page }) => {
    const actions = page.getByTestId('bare').locator('[data-slot="result-actions"]');
    const height = await actions.evaluate(el => el.getBoundingClientRect().height);
    expect(height).toBe(0);
});

test('result stays inside a 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
});

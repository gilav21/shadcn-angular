import { test, expect } from '@playwright/test';

/**
 * These run against a REAL install in a pristine Angular app, and they are
 * where drawing is actually proven: pointer capture, canvas rendering and
 * `toDataURL` all behave differently under a test double.
 */
test.describe('signature-pad', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    const canvas = '[data-testid="root"] [data-slot="signature-pad-canvas"]';

    /** Draw a short scribble with a real mouse, in the pad's own coordinates. */
    async function scribble(page: import('@playwright/test').Page, offset = 0) {
        const box = (await page.locator(canvas).boundingBox())!;
        await page.mouse.move(box.x + 20 + offset, box.y + 20);
        await page.mouse.down();
        await page.mouse.move(box.x + 80 + offset, box.y + 90, { steps: 8 });
        await page.mouse.move(box.x + 140 + offset, box.y + 40, { steps: 8 });
        await page.mouse.up();
    }

    test('starts blank', async ({ page }) => {
        await expect(page.getByTestId('state')).toHaveText('blank');
    });

    test('drawing produces a PNG data URL', async ({ page }) => {
        await scribble(page);

        await expect(page.getByTestId('state')).toHaveText('signed');
        const value = await page.getByTestId('length').textContent();
        expect(Number(value)).toBeGreaterThan(100);
    });

    test('clear empties the value again', async ({ page }) => {
        await scribble(page);
        await expect(page.getByTestId('state')).toHaveText('signed');

        await page.locator('[data-slot="signature-pad-clear"]').first().click();
        await expect(page.getByTestId('state')).toHaveText('blank');
    });

    /** Undo removes one stroke; two strokes minus one is still a signature. */
    test('undo removes the last stroke only', async ({ page }) => {
        await scribble(page);
        await scribble(page, 150);

        await page.locator('[data-slot="signature-pad-undo"]').first().click();
        await expect(page.getByTestId('state')).toHaveText('signed');

        await page.locator('[data-slot="signature-pad-undo"]').first().click();
        await expect(page.getByTestId('state')).toHaveText('blank');
    });

    /**
     * Asserted on the native button inside `ui-button`, not on the host
     * element: `toBeDisabled` reads the real control, and a host element with
     * a `disabled` attribute is not one.
     */
    test('offers nothing to undo or clear while blank', async ({ page }) => {
        await expect(
            page.locator('[data-slot="signature-pad-undo"] button, button[data-slot="signature-pad-undo"]').first(),
        ).toBeDisabled();
        await expect(
            page.locator('[data-slot="signature-pad-clear"] button, button[data-slot="signature-pad-clear"]').first(),
        ).toBeDisabled();
    });

    /** The page must not scroll out from under a stroke. */
    test('takes the touch gesture rather than letting the page have it', async ({ page }) => {
        const touchAction = await page
            .locator(canvas)
            .evaluate(element => getComputedStyle(element).touchAction);
        expect(touchAction).toBe('none');
    });

    test('names the surface and keeps it reachable', async ({ page }) => {
        await expect(page.locator(canvas)).toHaveAttribute('aria-label', 'Signature');
        await expect(page.locator(canvas)).toHaveAttribute('tabindex', '0');
    });

    test('can be shipped without the built-in controls', async ({ page }) => {
        await expect(
            page.locator('[data-testid="bare"] [data-slot="signature-pad-clear"]'),
        ).toHaveCount(0);
    });

    /** The bitmap must match the screen, or a signature is soft on every retina display. */
    test('sizes its backing store to the device pixel ratio', async ({ page }) => {
        const measured = await page.locator(canvas).evaluate(element => {
            const surface = element as HTMLCanvasElement;
            return {
                backing: surface.width,
                css: surface.getBoundingClientRect().width,
                ratio: window.devicePixelRatio,
            };
        });

        expect(measured.backing).toBe(Math.round(measured.css * measured.ratio));
    });
});

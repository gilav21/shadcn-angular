import { test, expect, type Page } from '@playwright/test';

/**
 * T-16 — e2e smoke: pan, zoom, item count.
 *
 * The harness loads the full 10,000-item budget, so this run proves what the
 * unit suite cannot: that a plain consumer install (no workspace dedup, AOT,
 * optimizer on) renders a huge graph with a bounded element count and responds
 * to real browser input.
 */

const ITEM = '[data-slot="canvas-item"]';
const DOM_ELEMENT_BUDGET = 400;

async function transformOf(page: Page): Promise<string> {
    return page.locator('[data-slot="canvas-viewport"]').evaluate(el => getComputedStyle(el).transform);
}

/** `matrix(a, b, c, d, tx, ty)` -> the scale and translation actually applied to the plane. */
async function matrixOf(page: Page): Promise<{ scale: number; x: number; y: number }> {
    const parsed = /matrix\(([^)]+)\)/.exec(await transformOf(page));
    if (!parsed) throw new Error('viewport carries no matrix transform');
    const parts = parsed[1].split(',').map(Number);
    return { scale: parts[0], x: parts[4], y: parts[5] };
}

async function reportedZoom(page: Page): Promise<number> {
    return Number(await page.getByTestId('zoom').innerText());
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator(ITEM).first()).toBeVisible();
});

test('renders the engine layers', async ({ page }) => {
    await expect(page.locator('[data-slot="infinite-canvas"]')).toBeVisible();
    await expect(page.locator('[data-slot="canvas-edges"]')).toBeAttached();
    await expect(page.locator('[data-slot="canvas-viewport"]')).toBeAttached();
});

test('keeps the DOM element count bounded at 10,000 items', async ({ page }) => {
    const mounted = await page.locator(ITEM).count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThanOrEqual(DOM_ELEMENT_BUDGET);
});

test('the transform wrapper is zero-sized', async ({ page }) => {
    const box = await page.locator('[data-slot="canvas-viewport"]').evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    });
    expect(box.width).toBe(0);
    expect(box.height).toBe(0);
});

test('dragging empty space pans the plane', async ({ page }) => {
    const before = await transformOf(page);
    const beforeMatrix = await matrixOf(page);

    const canvas = page.locator('[data-slot="infinite-canvas"]');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');

    // Aim at the bottom-right corner, which the sparse grid leaves empty.
    await page.mouse.move(box.x + box.width - 12, box.y + box.height - 12);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 212, box.y + box.height - 112, { steps: 10 });
    await page.mouse.up();

    await expect.poll(() => transformOf(page)).not.toBe(before);

    // The drag ran 200px left and 100px up, so the plane must follow the
    // pointer on both axes rather than merely having changed somehow.
    const afterMatrix = await matrixOf(page);
    expect(afterMatrix.x).toBeLessThan(beforeMatrix.x);
    expect(afterMatrix.y).toBeLessThan(beforeMatrix.y);
    expect(afterMatrix.scale).toBeCloseTo(beforeMatrix.scale, 5);
});

test('ctrl+wheel zooms', async ({ page }) => {
    const canvas = page.locator('[data-slot="infinite-canvas"]');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -240);
    await page.keyboard.up('Control');

    await expect.poll(() => reportedZoom(page)).toBeGreaterThan(1);

    // The number the component reports must be the number it actually applied.
    expect((await matrixOf(page)).scale).toBeCloseTo(await reportedZoom(page), 2);
});

test('the canvas is keyboard operable', async ({ page }) => {
    const before = await transformOf(page);
    const beforeMatrix = await matrixOf(page);

    await page.locator('[data-slot="infinite-canvas"]').focus();
    await page.keyboard.press('ArrowRight');

    await expect.poll(() => transformOf(page)).not.toBe(before);

    // ArrowRight is a horizontal pan: it must not disturb the other axis or the zoom.
    const afterMatrix = await matrixOf(page);
    expect(afterMatrix.x).not.toBe(beforeMatrix.x);
    expect(afterMatrix.y).toBeCloseTo(beforeMatrix.y, 5);
    expect(afterMatrix.scale).toBeCloseTo(beforeMatrix.scale, 5);
});

test('the imperative API is reachable through exportAs', async ({ page }) => {
    await page.getByTestId('zoom-in').click();
    await expect.poll(() => reportedZoom(page)).toBeGreaterThan(1);

    await page.getByTestId('reset').click();
    await expect.poll(() => reportedZoom(page)).toBe(1);

    // Reset must restore the identity transform, not merely report 1.
    const atReset = await matrixOf(page);
    expect(atReset.scale).toBeCloseTo(1, 5);
    expect(atReset.x).toBeCloseTo(0, 5);
    expect(atReset.y).toBeCloseTo(0, 5);

    await page.getByTestId('fit').click();
    await expect.poll(() => reportedZoom(page)).toBeLessThan(1);
    expect((await matrixOf(page)).scale).toBeCloseTo(await reportedZoom(page), 2);
});

test('the element count stays bounded after a long pan', async ({ page }) => {
    const canvas = page.locator('[data-slot="infinite-canvas"]');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');

    await page.mouse.move(box.x + box.width - 12, box.y + box.height - 12);
    await page.mouse.down();
    for (let step = 1; step <= 12; step++) {
        await page.mouse.move(box.x + box.width - 12 - step * 40, box.y + box.height - 12 - step * 20, { steps: 4 });
    }
    await page.mouse.up();

    expect(await page.locator(ITEM).count()).toBeLessThanOrEqual(DOM_ELEMENT_BUDGET);
});

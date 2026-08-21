import { test, expect } from '@playwright/test';

/**
 * T-16 for `stat-card` — the gate between "unit tests pass in the workspace"
 * and "this actually installs and renders in a pristine consumer app".
 */

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test('stat-card renders a card per tile', async ({ page }) => {
    await expect(page.getByTestId('grid')).toBeVisible();
    await expect(page.locator('[data-slot="card"]')).toHaveCount(4);
});

test('stat-card renders label, value and delta', async ({ page }) => {
    const tile = page.getByTestId('up');
    await expect(tile.locator('[data-slot="card-description"]')).toHaveText('Revenue');
    await expect(tile.locator('[data-slot="card-title"]')).toHaveText('$45,231');
    await expect(tile.locator('[data-slot="badge"]')).toHaveText('+12.5%');
});

test('stat-card reflects the trend in the badge and the arrow', async ({ page }) => {
    await expect(
        page.getByTestId('up').locator('[data-slot="stat-card-trend"]'),
    ).toHaveAttribute('data-trend', 'up');
    await expect(
        page.getByTestId('down').locator('[data-slot="stat-card-trend"]'),
    ).toHaveAttribute('data-trend', 'down');

    const upBadge = page.getByTestId('up').locator('[data-slot="badge"]');
    const downBadge = page.getByTestId('down').locator('[data-slot="badge"]');
    const upColour = await upBadge.evaluate(el => getComputedStyle(el).backgroundColor);
    const downColour = await downBadge.evaluate(
        el => getComputedStyle(el).backgroundColor,
    );
    expect(upColour).not.toBe(downColour);
});

test('stat-card omits the badge when no delta is given', async ({ page }) => {
    await expect(
        page.getByTestId('bare').locator('[data-slot="badge"]'),
    ).toHaveCount(0);
    await expect(page.getByTestId('bare').locator('[data-slot="card-title"]')).toHaveText(
        '2,350',
    );
});

test('stat-card renders projected chart content below the value', async ({ page }) => {
    const spark = page.getByTestId('spark');
    await expect(spark).toBeVisible();

    const title = page.getByTestId('projected').locator('[data-slot="card-title"]');
    const titleBox = await title.boundingBox();
    const sparkBox = await spark.boundingBox();
    expect(titleBox).not.toBeNull();
    expect(sparkBox).not.toBeNull();
    expect(sparkBox!.y).toBeGreaterThan(titleBox!.y);
});

test('stat-card keeps the host transparent so the card is the grid item', async ({
    page,
}) => {
    const display = await page
        .getByTestId('up')
        .evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('contents');
});

test('stat-card tiles stay inside a 320px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
});

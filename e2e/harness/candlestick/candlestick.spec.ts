import { test, expect } from '@playwright/test';

test('candlestick renders a body and a wick per session', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('[data-slot="candlestick-body"]')).toHaveCount(6);
    await expect(page.locator('[data-slot="candlestick-wick"]')).toHaveCount(6);
});

test('candlestick marks rising and falling sessions differently', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-slot="candlestick-candle"][data-direction="rising"]'))
        .toHaveCount(4);
    await expect(page.locator('[data-slot="candlestick-candle"][data-direction="falling"]'))
        .toHaveCount(2);
});

test('candlestick shows O/H/L/C on hover', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-slot="candlestick-candle"]').first().hover();
    const tooltip = page.locator('[data-slot="chart-tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Open');
    await expect(tooltip).toContainText('Close');
});

test('candlestick closes the weekend gap on the ordinal axis', async ({ page }) => {
    await page.goto('/');
    const centres = await page.locator('[data-slot="candlestick-wick"]').evaluateAll(
        nodes => nodes.map(n => Number(n.getAttribute('x1'))),
    );
    const gaps = centres.slice(1).map((x, i) => x - centres[i]);
    for (const gap of gaps) expect(Math.abs(gap - gaps[0])).toBeLessThan(0.5);
});

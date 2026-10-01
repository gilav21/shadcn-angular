import { test, expect } from '@playwright/test';

test('data-table-range-chart opens a dialog charting the range and switches chart type', async ({ page }) => {
    await page.goto('/');

    const chart = page.locator('[data-slot="range-chart"]');
    await expect(chart).toHaveCount(0);

    await page.getByTestId('open').click();

    await expect(chart).toBeVisible();
    await expect(chart.locator('svg').first()).toBeVisible();

    // Two series -> the stacked switcher is offered alongside bar and pie.
    const switcher = page.locator('[data-slot="range-chart-switcher"]');
    const pie = switcher.getByRole('button', { name: 'pie' });
    await expect(switcher.getByRole('button', { name: 'stacked' })).toBeVisible();

    // The pressed state is on the real <button>, where assistive technology reads it.
    await expect(pie).toHaveAttribute('aria-pressed', 'false');
    await pie.click();
    await expect(pie).toHaveAttribute('aria-pressed', 'true');
    await expect(chart.locator('svg').first()).toBeVisible();
});

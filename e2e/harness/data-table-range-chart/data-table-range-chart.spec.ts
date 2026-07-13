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
    const pie = switcher.locator('ui-button', { hasText: 'pie' });
    await expect(switcher.locator('ui-button', { hasText: 'stacked' })).toBeVisible();

    // NOTE: the component binds `aria-pressed` on the `<ui-button>` host, not on
    // the inner native <button>, so the state is asserted on the host element.
    await expect(pie).toHaveAttribute('aria-pressed', 'false');
    await pie.click();
    await expect(pie).toHaveAttribute('aria-pressed', 'true');
    await expect(chart.locator('svg').first()).toBeVisible();
});

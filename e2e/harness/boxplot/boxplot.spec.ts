import { test, expect } from '@playwright/test';

test('boxplot renders one box per group, from raw values and from stats alike', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('[data-slot="boxplot-box"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="boxplot-median"]')).toHaveCount(3);
});

test('boxplot renders the 1.5 IQR outlier as its own point', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-slot="boxplot-outlier"]')).toHaveCount(1);
    await expect(page.locator('[data-slot="boxplot-outlier"]').first())
        .toHaveAttribute('aria-label', /92/);
});

test('boxplot shows the five-number summary on hover', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-slot="boxplot-box"]').first().hover();
    const tooltip = page.locator('[data-slot="chart-tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Median');
});

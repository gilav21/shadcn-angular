import { test, expect } from '@playwright/test';

test('treemap renders a rectangle per node, groups included', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.locator('[data-slot="treemap-cell"]')).toHaveCount(6);
    await expect(page.locator('[data-slot="treemap-cell"][data-leaf="false"]')).toHaveCount(1);
});

test('treemap nests children inside their group', async ({ page }) => {
    await page.goto('/');
    const group = page.locator('[data-slot="treemap-cell"][data-leaf="false"]').first();
    const groupBox = (await group.boundingBox())!;
    const child = page.locator('[data-slot="treemap-cell"][data-depth="1"]').first();
    const childBox = (await child.boundingBox())!;

    expect(childBox.x).toBeGreaterThanOrEqual(groupBox.x - 1);
    expect(childBox.y).toBeGreaterThanOrEqual(groupBox.y - 1);
    expect(childBox.x + childBox.width).toBeLessThanOrEqual(groupBox.x + groupBox.width + 1);
});

test('treemap emits the clicked node data', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('clicked')).toHaveText('none');
    await page.locator('[data-slot="treemap-cell"][data-depth="1"]').first().click();
    await expect(page.getByTestId('clicked')).not.toHaveText('none');
});

test('treemap labels the big rectangles and shows a share tooltip', async ({ page }) => {
    await page.goto('/');
    const labels = page.locator('[data-slot="treemap-label"]');
    expect(await labels.count()).toBeGreaterThan(0);

    await page.locator('[data-slot="treemap-cell"]').nth(1).hover();
    const tooltip = page.locator('[data-slot="chart-tooltip"]');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Share');
});

import { test, expect } from '@playwright/test';

test('pie-chart-drilldown renders slices and drills into a series on click', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    const slices = root.locator('svg path');
    expect(await slices.count()).toBeGreaterThanOrEqual(3);

    await slices.first().click({ force: true });
    await expect(root).toContainText(/v120|v119|Chrome versions|Back/);
});

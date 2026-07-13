import { test, expect } from '@playwright/test';

test('bar-chart-drilldown renders bars and drills into a series on click', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    const bars = root.locator('svg rect');
    expect(await bars.count()).toBeGreaterThanOrEqual(3);

    await bars.first().click({ force: true });
    await expect(root).toContainText(/DE|FR|EMEA countries|Back/);
});

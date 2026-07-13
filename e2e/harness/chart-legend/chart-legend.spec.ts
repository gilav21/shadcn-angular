import { test, expect } from '@playwright/test';

test('chart-legend lists its items and emits a toggle on click', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('Series A');
    await expect(root).toContainText('Series B');

    await root.getByText('Series A').click();
    await expect(page.getByTestId('hidden')).toHaveText('a');

    await root.getByText('Series A').click();
    await expect(page.getByTestId('hidden')).toBeEmpty();
});

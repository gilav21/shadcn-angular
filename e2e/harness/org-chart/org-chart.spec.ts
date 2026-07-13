import { test, expect } from '@playwright/test';

test('org-chart renders every node in the hierarchy', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('Ada');
    await expect(root).toContainText('Grace');
    await expect(root).toContainText('Linus');
});

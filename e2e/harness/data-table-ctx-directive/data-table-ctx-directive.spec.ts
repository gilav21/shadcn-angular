import { test, expect } from '@playwright/test';

test('data-table-context-menu directive opens the menu on a row right-click and reports the row', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('Beta');

    const content = page.locator('[data-slot="context-menu-content"]');
    await expect(content).toHaveCount(0);

    await root.getByText('Beta').click({ button: 'right' });

    await expect(content).toBeVisible();
    await expect(content).toContainText('Delete');
    await expect(page.getByTestId('row')).toHaveText('Beta');
});

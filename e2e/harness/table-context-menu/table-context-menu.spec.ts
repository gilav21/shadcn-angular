import { test, expect } from '@playwright/test';

test('table-context-menu opens the menu on a row right-click and reports that row', async ({ page }) => {
    await page.goto('/');

    const content = page.locator('[data-slot="context-menu-content"]');
    await expect(content).toHaveCount(0);

    await page.locator('[data-name="Beta"]').click({ button: 'right' });

    await expect(content).toBeVisible();
    await expect(content).toContainText('Delete');
    // index from data-row-index, payload JSON-parsed out of data-row.
    await expect(page.getByTestId('row')).toHaveText('1:Beta');
});

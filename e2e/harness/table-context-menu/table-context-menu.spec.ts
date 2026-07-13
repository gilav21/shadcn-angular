import { test, expect } from '@playwright/test';

test('table-context-menu opens the menu on a row right-click and reports the row', async ({ page }) => {
    await page.goto('/');

    const content = page.locator('[data-slot="context-menu-content"]');
    await expect(content).toHaveCount(0);

    await page.locator('[data-row="Beta"]').click({ button: 'right' });

    await expect(content).toBeVisible();
    await expect(content).toContainText('Delete');
    await expect(page.getByTestId('row')).not.toBeEmpty();
});

import { test, expect } from '@playwright/test';

test('context-menu-attach opens the bound menu and reports the row it was fired on', async ({ page }) => {
    await page.goto('/');

    const content = page.locator('[data-slot="context-menu-content"]');
    await expect(content).toHaveCount(0);

    await page.locator('[data-row="2"]').click({ button: 'right' });

    await expect(content).toBeVisible();
    await expect(content).toContainText('Rename');
    await expect(page.getByTestId('target')).toHaveText('Beta');
});

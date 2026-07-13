import { test, expect } from '@playwright/test';

test('tree-context-menu opens the menu on a tree item right-click and reports the node', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('src');

    const content = page.locator('[data-slot="context-menu-content"]');
    await expect(content).toHaveCount(0);

    await page.getByText('app.ts').click({ button: 'right' });

    await expect(content).toBeVisible();
    await expect(content).toContainText('Rename');
    await expect(page.getByTestId('node')).not.toBeEmpty();
});

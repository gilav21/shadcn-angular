import { test, expect } from '@playwright/test';

test('context-menu opens on right-click, runs an item action, closes on Escape', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByTestId('context-menu-trigger');
    await expect(trigger).toBeVisible();

    const content = page.locator('[data-slot="context-menu-content"]');
    await expect(content).toHaveCount(0);

    await trigger.click({ button: 'right' });
    await expect(content).toBeVisible();
    await expect(page.getByText('Actions')).toBeVisible();

    const items = page.locator('[data-slot="context-menu-item"]');
    await items.filter({ hasText: 'Copy' }).click();
    await expect(page.getByTestId('last-action')).toHaveText('copy');
    await expect(content).toHaveCount(0);

    await trigger.click({ button: 'right' });
    await expect(content).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(content).toHaveCount(0);
});

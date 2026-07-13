import { test, expect } from '@playwright/test';

test('speed-dial toggles its menu from the trigger', async ({ page }) => {
    await page.goto('/');

    const root = page.locator('[data-slot="speed-dial"]');
    const trigger = page.locator('[data-slot="speed-dial-trigger"]');
    await expect(trigger).toBeVisible();
    await expect(root).toHaveAttribute('data-state', 'closed');
    await expect(page.getByTestId('visible')).toHaveText('closed');

    await trigger.click();
    await expect(page.getByTestId('visible')).toHaveText('open');
    await expect(root).toHaveAttribute('data-state', 'open');
    await expect(page.getByRole('button', { name: 'A' })).toBeVisible();

    await trigger.click();
    await expect(page.getByTestId('visible')).toHaveText('closed');
    await expect(root).toHaveAttribute('data-state', 'closed');
});

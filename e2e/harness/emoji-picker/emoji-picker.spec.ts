import { test, expect } from '@playwright/test';

test('emoji-picker opens on trigger click and emits the selected emoji', async ({ page }) => {
    await page.goto('/');

    const content = page.locator('[data-slot="emoji-picker-content"]');
    await expect(content).toHaveCount(0);

    await page.getByRole('button', { name: 'Pick an emoji' }).click();
    await expect(content).toBeVisible();

    await content.locator('button').nth(12).click();

    await expect(page.getByTestId('picked')).not.toBeEmpty();
    await expect(content).toHaveCount(0);
});

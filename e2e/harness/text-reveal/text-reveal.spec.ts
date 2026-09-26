import { test, expect } from '@playwright/test';

test('text-reveal renders one span per word', async ({ page }) => {
    await page.goto('/');
    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root.locator('span')).toHaveText(['Reveal', 'every', 'word', 'in', 'turn']);
});

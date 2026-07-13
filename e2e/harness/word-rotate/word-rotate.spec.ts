import { test, expect } from '@playwright/test';

test('word-rotate cycles through the supplied words', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('design');
    await expect(root).toContainText('build', { timeout: 5000 });
});

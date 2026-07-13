import { test, expect } from '@playwright/test';

test('streaming-text types the text out and emits complete', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('Hello from the stream');
    await expect(page.getByTestId('complete')).toHaveText('complete');
});

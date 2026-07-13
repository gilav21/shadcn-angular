import { test, expect } from '@playwright/test';

test('number-ticker renders its value and re-renders when it changes', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('7');

    await page.getByTestId('bump').click();
    await expect(root).toContainText('42');
});

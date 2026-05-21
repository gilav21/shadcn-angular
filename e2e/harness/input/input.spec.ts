import { test, expect } from '@playwright/test';

test('input reflects typed value via ngModel', async ({ page }) => {
    await page.goto('/');
    const input = page.getByTestId('input').locator('input');
    await expect(input).toBeVisible();
    await expect(page.getByTestId('echo')).toHaveText('');

    await input.fill('hello world');
    await expect(page.getByTestId('echo')).toHaveText('hello world');

    await input.fill('');
    await expect(page.getByTestId('echo')).toHaveText('');
});

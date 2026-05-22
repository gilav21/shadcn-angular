import { test, expect } from '@playwright/test';

test('button renders and increments on click', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('primary')).toBeVisible();
    await expect(page.getByTestId('count')).toHaveText('0');
    await page.getByTestId('primary').click();
    await expect(page.getByTestId('count')).toHaveText('1');
    await page.getByTestId('primary').click();
    await expect(page.getByTestId('count')).toHaveText('2');
});

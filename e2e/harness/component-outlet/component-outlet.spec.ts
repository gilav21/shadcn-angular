import { test, expect } from '@playwright/test';

test('component-outlet renders the bound component with its inputs and swaps it', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.getByTestId('red')).toHaveText('Red: from outlet');
    await expect(page.getByTestId('blue')).toHaveCount(0);

    await page.getByTestId('swap').click();

    await expect(page.getByTestId('blue')).toBeVisible();
    await expect(page.getByTestId('red')).toHaveCount(0);
});

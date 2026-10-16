import { test, expect } from '@playwright/test';

test('slider starts at its defaultValue and arrow keys step from it', async ({ page }) => {
    await page.goto('/');

    const range = page.getByRole('slider', { name: 'Volume' });
    await expect(range).toHaveValue('40');

    await range.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await expect(page.getByTestId('value')).toHaveText('43');
    await expect(range).toHaveValue('43');
});

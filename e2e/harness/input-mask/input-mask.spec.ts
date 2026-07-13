import { test, expect } from '@playwright/test';

test('input-mask formats typed digits into the mask pattern', async ({ page }) => {
    await page.goto('/');

    const input = page.getByTestId('root');
    await expect(input).toBeVisible();

    await input.click();
    await input.pressSequentially('5551234567');

    await expect(input).toHaveValue('(555) 123-4567');
});

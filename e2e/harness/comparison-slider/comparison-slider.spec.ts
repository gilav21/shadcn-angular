import { test, expect } from '@playwright/test';

test('comparison-slider moves the wipe position with the keyboard', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root.locator('img')).toHaveCount(2);

    const slider = page.getByRole('slider');
    await expect(slider).toBeVisible();

    const position = (): Promise<string> => slider.inputValue();
    const before = await position();

    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await expect.poll(position).not.toBe(before);
});

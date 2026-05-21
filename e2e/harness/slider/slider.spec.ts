import { test, expect } from '@playwright/test';

test('slider updates value via keyboard arrows', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('value')).toHaveText('0');

    // Slider exposes its thumb as role=slider; focus it and press arrows.
    const thumb = page.getByRole('slider').first();
    await thumb.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    // Default step=1, so 3 presses -> 3.
    await expect(page.getByTestId('value')).toHaveText('3');
});

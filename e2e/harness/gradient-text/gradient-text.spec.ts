import { test, expect } from '@playwright/test';

test('gradient-text paints its text with a gradient background', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('Gradient heading');

    const painted = await root.evaluate((el: HTMLElement) => {
        const target = (el.querySelector('[data-slot]') ?? el.firstElementChild ?? el) as HTMLElement;
        return getComputedStyle(target).backgroundImage;
    });
    expect(painted).toContain('gradient');
});

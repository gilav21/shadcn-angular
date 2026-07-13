import { test, expect } from '@playwright/test';

test('confetti mounts a canvas over the host and paints on trigger', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    const canvas = root.locator('canvas');
    await expect(canvas).toHaveCount(1);
    await expect(root).toHaveCSS('overflow', 'hidden');

    const blank = (): Promise<boolean> =>
        canvas.evaluate((el: HTMLCanvasElement) => {
            const ctx = el.getContext('2d');
            if (!ctx) return true;
            const { data } = ctx.getImageData(0, 0, el.width, el.height);
            return !data.some((v, i) => i % 4 === 3 && v !== 0);
        });

    expect(await blank()).toBe(true);

    await page.getByTestId('fire').click();
    await expect.poll(blank, { timeout: 5000 }).toBe(false);
});

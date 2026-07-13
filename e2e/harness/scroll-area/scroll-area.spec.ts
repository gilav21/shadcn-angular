import { test, expect } from '@playwright/test';

test('scroll-area clips its content and scrolls the viewport', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('root')).toBeVisible();

    const viewport = page.locator('[data-slot="scroll-area-viewport"]').first();
    await expect(viewport).toBeVisible();

    const scrollable = await viewport.evaluate((el: HTMLElement) => el.scrollHeight > el.clientHeight);
    expect(scrollable).toBe(true);

    await viewport.evaluate((el: HTMLElement) => { el.scrollTop = 200; });
    await expect.poll(() => viewport.evaluate((el: HTMLElement) => el.scrollTop)).toBeGreaterThan(100);
});

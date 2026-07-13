import { test, expect } from '@playwright/test';

test('scroll-progress grows its bar as the page scrolls', async ({ page }) => {
    await page.goto('/');

    const bar = page.locator('[data-slot="scroll-progress"]');
    await expect(bar).toBeAttached();

    const widthAt = async (): Promise<number> =>
        bar.evaluate((el: HTMLElement) => {
            const inner = (el.firstElementChild ?? el) as HTMLElement;
            return inner.getBoundingClientRect().width;
        });

    const before = await widthAt();
    await page.evaluate(() => globalThis.scrollTo(0, 2000));
    await expect.poll(widthAt).toBeGreaterThan(before);
});

import { test, expect } from '@playwright/test';

test('ripple injects a ripple element on click and cleans it up', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    const childCount = (): Promise<number> => root.evaluate((el: HTMLElement) => el.childElementCount);
    expect(await childCount()).toBe(0);

    await root.click();
    await expect.poll(childCount).toBeGreaterThan(0);

    // The ripple element removes itself once the animation finishes.
    await expect.poll(childCount, { timeout: 5000 }).toBe(0);
});

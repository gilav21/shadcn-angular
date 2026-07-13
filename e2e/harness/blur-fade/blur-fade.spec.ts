import { test, expect } from '@playwright/test';

test('blur-fade reveals its projected content', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('Faded in');
    await expect.poll(() => root.evaluate((el: HTMLElement) => {
        const inner = el.firstElementChild as HTMLElement | null;
        return inner ? Number.parseFloat(getComputedStyle(inner).opacity) : 0;
    })).toBeGreaterThan(0.9);
});

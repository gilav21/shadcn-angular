import { test, expect } from '@playwright/test';

test('magnetic translates the element toward the pointer and resets on leave', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    const transformOf = (): Promise<string> =>
        root.evaluate((el: HTMLElement) => getComputedStyle(el).transform);

    const box = (await root.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 5 });
    await expect.poll(transformOf).not.toBe('none');

    await page.mouse.move(0, 0, { steps: 5 });
    await expect.poll(transformOf, { timeout: 5000 }).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
});

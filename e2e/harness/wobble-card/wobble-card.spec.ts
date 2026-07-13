import { test, expect } from '@playwright/test';

test('wobble-card tilts when the pointer moves across it', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('Hover me');

    const transformOf = (): Promise<string> =>
        root.evaluate((el: HTMLElement) => getComputedStyle(el).transform);

    const box = (await root.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10, { steps: 5 });

    await expect.poll(transformOf).not.toBe('none');
});

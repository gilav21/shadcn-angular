import { test, expect } from '@playwright/test';

test('resizable drags the handle and resizes the panels', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    const left = page.locator('[data-slot="resizable-panel"]').first();
    const handle = page.locator('[data-slot="resizable-handle"]').first();
    await expect(handle).toBeVisible();

    const before = (await left.boundingBox())!.width;

    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();

    await expect.poll(async () => (await left.boundingBox())!.width).toBeGreaterThan(before + 50);
});

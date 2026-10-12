import { test, expect } from '@playwright/test';

test('kanban renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

test.describe('on a touch screen', () => {
    test.use({ hasTouch: true });

    // UC-10: iOS never raises contextmenu, and the card menu's "Move to" is the
    // only way to move a card without a pointer-driven drag.
    test('a long-press on a card opens its menu and Move to relocates the card', async ({ page }) => {
        await page.goto('/');
        const card = page.getByTestId('board').locator('[data-card-id="c1"]');
        const box = (await card.boundingBox())!;
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const session = await page.context().newCDPSession(page);

        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await page.waitForTimeout(650);
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

        await expect(page.getByText('Move to')).toBeVisible();
        await page.getByText('Move to').tap();
        await page.locator('[data-slot="context-menu-sub-content"]').getByText('Done').tap();

        await expect(page.getByTestId('board').locator('[data-column-id="done"] [data-card-id="c1"]')).toBeVisible();
    });
});

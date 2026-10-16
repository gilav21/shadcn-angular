import { test, expect } from '@playwright/test';

test('tree-context-menu opens the menu on a tree item right-click and reports the node', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(root).toContainText('src');

    const content = page.locator('[data-slot="context-menu-content"]');
    await expect(content).toHaveCount(0);

    await page.getByTestId('root').getByText('app.ts').click({ button: 'right' });

    await expect(content).toBeVisible();
    await expect(content).toContainText('Rename');
    await expect(page.getByTestId('node')).not.toBeEmpty();
});

test.describe('on a touch screen', () => {
    test.use({ hasTouch: true });

    // UC-9, UC-11: a held finger opens the menu once. Chromium's touch emulation
    // may raise its own contextmenu after the hold - exactly the Android case - and
    // the emitted-event count says whether the second one was swallowed.
    test('a long-press on a tree item opens the menu once', async ({ page }) => {
        await page.goto('/');
        const box = (await page.getByTestId('root').getByText('app.ts').boundingBox())!;
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        const session = await page.context().newCDPSession(page);

        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await page.waitForTimeout(650);
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(300);

        const content = page.locator('[data-slot="context-menu-content"]');
        await expect(content).toBeVisible();
        await expect(content).toContainText('Rename');
        await expect(page.getByTestId('opened')).toHaveText('1');
    });
});

// UC-5: the keyboard context-menu key on a focused tree item opens the menu, and
// focus moves into it.
test('Shift+F10 on a focused tree item opens the menu with its first item focused', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('root').getByText('app.ts').click();
    await page.keyboard.press('Shift+F10');

    const content = page.locator('[data-slot="context-menu-content"]');
    await expect(content).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
});

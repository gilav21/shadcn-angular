import { test, expect } from '@playwright/test';

test.describe('duration-input', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('splits the duration across its segments', async ({ page }) => {
        const root = page.getByTestId('root');
        await expect(root.locator('[data-unit="hours"]')).toHaveValue('1');
        await expect(root.locator('[data-unit="minutes"]')).toHaveValue('30');
    });

    /** Nothing is dropped just because a unit is not on screen. */
    test('lets the leading unit absorb what it cannot show', async ({ page }) => {
        await expect(
            page.getByTestId('absorbing').locator('[data-unit="minutes"]'),
        ).toHaveValue('90');
    });

    test('adds up what is typed into each segment', async ({ page }) => {
        const root = page.getByTestId('root');
        await root.locator('[data-unit="hours"]').fill('2');
        await root.locator('[data-unit="minutes"]').fill('15');

        await expect(page.getByTestId('value')).toHaveText('8100');
    });

    test('steps a segment with the arrow keys', async ({ page }) => {
        const minutes = page.getByTestId('root').locator('[data-unit="minutes"]');
        await minutes.click();
        await minutes.press('ArrowUp');

        await expect(page.getByTestId('value')).toHaveText('5460');
    });

    test('is reachable and operable from the keyboard alone', async ({ page }) => {
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-unit'));
        expect(['hours', 'minutes']).toContain(focused);
    });

    test('announces each segment as a spinbutton with its unit', async ({ page }) => {
        const minutes = page.getByTestId('root').locator('[data-unit="minutes"]');
        await expect(minutes).toHaveAttribute('role', 'spinbutton');
        await expect(minutes).toHaveAttribute('aria-valuetext', '30 minutes');
    });
});

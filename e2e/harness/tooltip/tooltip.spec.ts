import { test, expect } from '@playwright/test';

test('tooltip appears on hover and hides on leave', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByTestId('trigger');
    await expect(trigger).toBeVisible();
    await expect(page.getByTestId('content')).toBeHidden();

    await trigger.hover();
    await expect(page.getByTestId('content')).toBeVisible();
    await expect(page.getByTestId('content')).toContainText('Helpful hint');

    await page.mouse.move(0, 0);
    await expect(page.getByTestId('content')).toBeHidden();
});

test.describe('on a touch screen', () => {
    test.use({ hasTouch: true });

    // UC-7, UC-8: the tap shows the tooltip, the tooltip outlives the tap that
    // opened it, and the control the trigger wraps still gets its own tap.
    test('tapping a control wrapped in the trigger shows the tooltip and runs the control once', async ({ page }) => {
        await page.goto('/');
        // The tap path only engages on a coarse pointer; record that the emulation provides one.
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);

        await expect(page.getByTestId('content')).toBeHidden();
        await page.getByRole('button', { name: 'Hover me' }).tap();

        await page.waitForTimeout(300);
        await expect(page.getByTestId('content')).toBeVisible();
        await expect(page.getByTestId('taps')).toHaveText('1');
    });
});

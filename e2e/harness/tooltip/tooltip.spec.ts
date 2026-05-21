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

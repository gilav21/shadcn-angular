import { test, expect } from '@playwright/test';

test('multi-component form: type, submit, confirm dialog shows value, ESC dismisses', async ({ page }) => {
    await page.goto('/');

    // Confirmation dialog hidden initially.
    await expect(page.getByTestId('confirm-title')).toBeHidden();

    const input = page.getByTestId('username').locator('input');
    await input.fill('Codex');

    // Open the dialog via the trigger.
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('confirm-title')).toBeVisible();
    await expect(page.getByTestId('confirm-body')).toContainText('You entered: Codex');

    // Dismiss with Escape.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('confirm-title')).toBeHidden();
});

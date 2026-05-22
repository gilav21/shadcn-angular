import { test, expect } from '@playwright/test';

test('input-otp accepts 6 digits and exposes the concatenated value', async ({ page }) => {
    await page.goto('/');

    // The ui-input-otp host has class="contents" so it has no visible
    // box. Target its underlying <input> directly (input-otp keeps one
    // hidden text-input behind the slots and proxies keystrokes to it).
    const otpInput = page.getByTestId('otp').locator('input').first();
    await expect(otpInput).toHaveCount(1);
    await expect(page.getByTestId('value')).toHaveText('');

    await otpInput.focus();
    await page.keyboard.type('123456');

    await expect(page.getByTestId('value')).toHaveText('123456');
});

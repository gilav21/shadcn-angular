import { test, expect } from '@playwright/test';

test('reactive form: ui-input + ui-checkbox plug into Validators correctly', async ({ page }) => {
    await page.goto('/');

    // Initial state: form is invalid, submit disabled, no error messages
    // shown (nothing touched).
    await expect(page.getByTestId('status')).toHaveText('invalid');
    const submit = page.getByTestId('submit').locator('button');
    await expect(submit).toBeDisabled();
    await expect(page.getByTestId('email-required')).toBeHidden();

    // Focus the email, blur it without typing → "required" appears.
    const email = page.getByTestId('email').locator('input');
    await email.focus();
    await email.blur();
    await expect(page.getByTestId('email-required')).toBeVisible();

    // Type an invalid email → format error replaces required error.
    await email.fill('not-an-email');
    await email.blur();
    await expect(page.getByTestId('email-required')).toBeHidden();
    await expect(page.getByTestId('email-format')).toBeVisible();

    // Fix the email.
    await email.fill('user@example.com');
    await email.blur();
    await expect(page.getByTestId('email-format')).toBeHidden();

    // Password: short → minlength error after touch.
    const password = page.getByTestId('password').locator('input');
    await password.fill('123');
    await password.blur();
    await expect(page.getByTestId('password-min')).toBeVisible();
    await expect(submit).toBeDisabled();

    // Long enough → error disappears.
    await password.fill('correct-horse');
    await expect(page.getByTestId('password-min')).toBeHidden();

    // Form still invalid because the terms checkbox is unchecked.
    await expect(page.getByTestId('status')).toHaveText('invalid');
    await expect(submit).toBeDisabled();

    // Check the terms → form becomes valid + submit enabled.
    const tos = page.getByTestId('agreed').locator('button, [role="checkbox"]').first();
    await tos.click();
    await expect(page.getByTestId('status')).toHaveText('valid');
    await expect(submit).toBeEnabled();
});

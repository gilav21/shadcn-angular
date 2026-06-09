import { test, expect } from '@playwright/test';

test('field renders all parts', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.getByTestId('field-label')).toHaveText('Email');
    await expect(page.getByTestId('field-description')).toContainText('We never share your email.');
    await expect(page.getByTestId('field-error')).toContainText('Static error message');
});

test('auto-errors stays silent while the control is untouched', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('field-auto-errors')).not.toContainText('required');
});

test('auto-errors shows the required message after blur', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('email-input').focus();
    await page.getByTestId('email-input').blur();
    const error = page.getByTestId('field-auto-errors').locator('[data-slot="field-error"]');
    await expect(error).toHaveText('This field is required');
    await expect(error).toHaveAttribute('role', 'alert');
});

test('auto-errors interpolates the minlength message and clears when valid', async ({ page }) => {
    await page.goto('/');
    const input = page.getByTestId('email-input');
    await input.fill('ab');
    await input.blur();
    const error = page.getByTestId('field-auto-errors').locator('[data-slot="field-error"]');
    await expect(error).toHaveText('Minimum 5 characters');

    await input.fill('valid input');
    await expect(error).toHaveCount(0);
});

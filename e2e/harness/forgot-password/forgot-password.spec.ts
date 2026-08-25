import { test, expect } from '@playwright/test';

// T-3 — submits an email and shows the confirmation the emission drives.
test('forgot-password: submitting an email swaps the form for a confirmation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.getByTestId('confirmation')).toHaveCount(0);

    await page.getByLabel('Email').fill('ada@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByTestId('confirmation')).toHaveText('Reset link sent to ada@example.com');
    // The form is gone — proof the emission actually reached the app.
    await expect(page.getByTestId('root')).toHaveCount(0);
});

test('forgot-password: the email field starts empty and is labelled', async ({ page }) => {
    await page.goto('/');

    const email = page.getByLabel('Email');
    await expect(email).toHaveValue('');
    await expect(email).toHaveAttribute('type', 'email');
});

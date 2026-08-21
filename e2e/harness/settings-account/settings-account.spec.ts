import { test, expect } from '@playwright/test';

const DELETE_BUTTON = { name: 'Delete account' };

// T-6 — toggles a setting (the danger-zone disclosure) and submits.
test('settings-account: the danger zone toggles open and its action emits', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();

    // Collapsed: the destructive action is not in the DOM at all.
    await expect(page.getByRole('button', DELETE_BUTTON)).toHaveCount(0);

    await page.getByRole('button', { name: 'Toggle danger zone' }).click();
    await expect(page.getByRole('button', DELETE_BUTTON)).toBeVisible();

    await page.getByRole('button', DELETE_BUTTON).click();
    await expect(page.getByTestId('delete-count')).toHaveText('1');

    // Toggling again collapses it back.
    await page.getByRole('button', { name: 'Toggle danger zone' }).click();
    await expect(page.getByRole('button', DELETE_BUTTON)).toHaveCount(0);
});

test('settings-account: changing the password fields carries them into the submit', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByLabel('Email')).toHaveValue('ada@example.com');

    await page.getByLabel('Current password').fill('old-pw');
    await page.getByLabel('New password', { exact: true }).fill('new-pw');
    await page.getByLabel('Confirm new password').fill('new-pw');

    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByTestId('submitted')).toHaveText('ada@example.com|old-pw|new-pw');
    await expect(page.getByTestId('submit-count')).toHaveText('1');
});

test('settings-account: the danger-zone action does not submit the form', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Toggle danger zone' }).click();
    await page.getByRole('button', DELETE_BUTTON).click();

    // type="button" — a regression to the default would also fire ngSubmit.
    await expect(page.getByTestId('delete-count')).toHaveText('1');
    await expect(page.getByTestId('submit-count')).toHaveText('0');
});

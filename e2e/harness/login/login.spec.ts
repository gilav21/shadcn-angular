import { test, expect } from '@playwright/test';

// T-1 — fills credentials, submits, asserts the submit event carries them.
test('login: submitting the form emits the typed credentials', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();

    // Nothing emitted before the user does anything.
    await expect(page.getByTestId('submit-count')).toHaveText('0');
    await expect(page.getByTestId('submitted')).toHaveCount(0);

    await page.getByLabel('Email').fill('ada@example.com');
    await page.getByLabel('Password').fill('s3cret');
    await page.getByLabel('Remember me').check();

    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByTestId('submitted')).toHaveText('ada@example.com|s3cret|true');
    await expect(page.getByTestId('submit-count')).toHaveText('1');
});

test('login: remember-me defaults to false and is carried through unchecked', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Email').fill('grace@example.com');
    await page.getByLabel('Password').fill('pw');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByTestId('submitted')).toHaveText('grace@example.com|pw|false');
});

test('login: the Google button does not submit the form', async ({ page }) => {
    await page.goto('/');

    // type="button" — a regression to the default (submit) would fire ngSubmit.
    await page.getByRole('button', { name: 'Login with Google' }).click();

    await expect(page.getByTestId('submit-count')).toHaveText('0');
});

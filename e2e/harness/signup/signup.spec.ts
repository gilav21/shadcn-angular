import { test, expect } from '@playwright/test';

const ERROR = '[data-slot="signup-error"]';

// T-2 — validation blocks an empty submit, then the same form succeeds.
test('signup: empty submit is blocked, then a complete form succeeds', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();

    // The error is only surfaced after an attempt — not on first paint.
    await expect(page.locator(ERROR)).toHaveCount(0);

    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator(ERROR)).toHaveText('Enter your name.');
    await expect(page.getByTestId('submit-count')).toHaveText('0');
    await expect(page.getByTestId('submitted')).toHaveCount(0);

    await page.getByLabel('Name').fill('Ada Lovelace');
    await page.getByLabel('Email').fill('ada@example.com');
    await page.getByLabel('Password', { exact: true }).fill('s3cret');
    await page.getByLabel('Confirm password').fill('s3cret');

    // Still blocked — the terms checkbox is the last unmet requirement.
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.locator(ERROR)).toHaveText('Accept the Terms of Service to continue.');
    await expect(page.getByTestId('submit-count')).toHaveText('0');

    await page.getByLabel(/I agree to the Terms of Service/).check();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByTestId('submitted')).toHaveText('Ada Lovelace|ada@example.com|true');
    await expect(page.getByTestId('submit-count')).toHaveText('1');
    await expect(page.locator(ERROR)).toHaveCount(0);
});

test('signup: mismatched passwords are rejected', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Name').fill('Ada');
    await page.getByLabel('Email').fill('ada@example.com');
    await page.getByLabel('Password', { exact: true }).fill('s3cret');
    await page.getByLabel('Confirm password').fill('different');
    await page.getByLabel(/I agree to the Terms of Service/).check();

    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.locator(ERROR)).toHaveText('Passwords do not match.');
    await expect(page.getByTestId('submit-count')).toHaveText('0');
});

import { test, expect } from '@playwright/test';

// T-5 — edits a field and submits; the edit must reach the emitted payload.
test('settings-profile: an edited field is carried into the submit payload', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();

    // The block seeds itself with an existing profile.
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Ada Lovelace');

    await page.getByLabel('Name', { exact: true }).fill('Grace Hopper');
    // NOTE: located by data-slot, not by label. `ui-textarea` exposes no
    // `elementId`/`ariaLabel` input, so the block's `<ui-label>Bio</ui-label>`
    // is not associated with the control and `getByLabel('Bio')` cannot match.
    // Reported as an a11y finding — fixing it means changing the shared
    // textarea component, which is outside this bundle's scope.
    await page.locator('textarea[data-slot="textarea"]').fill('Compiler pioneer.');

    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByTestId('submitted'))
        .toHaveText('Grace Hopper|Software Engineer|Compiler pioneer.');
    await expect(page.getByTestId('submit-count')).toHaveText('1');
});

test('settings-profile: the avatar fallback tracks the name', async ({ page }) => {
    await page.goto('/');

    const avatar = page.locator('[data-slot="avatar-fallback"]');
    await expect(avatar).toHaveText('AL');

    await page.getByLabel('Name', { exact: true }).fill('Grace Hopper');
    await expect(avatar).toHaveText('GH');
});

test('settings-profile: Cancel does not submit', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByTestId('submit-count')).toHaveText('0');
});

import { test, expect } from '@playwright/test';

test('color picker renders the trigger and opens the popover', async ({ page }) => {
    await page.goto('/');
    const picker = page.getByTestId('root');
    await expect(picker).toBeVisible();
    await picker.locator('button').first().click();
    await expect(page.locator('ui-popover-content')).toBeVisible();
});

test('selecting a preset updates the bound value', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('root').locator('button').first().click();
    await page.locator('ui-popover-content button[aria-label="Select #ef4444"]').click();
    await expect(page.getByTestId('value')).toHaveText('#ef4444');
});

test('eyedropper and image-pick triggers are present when enabled', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('root').locator('button').first().click();
    await expect(page.locator('button[data-slot="eyedropper-trigger"]')).toBeVisible();
    await expect(page.locator('button[data-slot="image-pick-trigger"]')).toBeVisible();
});

test('OKLCH tab is available when included in formats', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('root').locator('button').first().click();
    await expect(
        page.locator('ui-popover-content').getByRole('tab', { name: /oklch/i }),
    ).toBeVisible();
});

test('alpha slider appears when alpha is enabled', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('root').locator('button').first().click();
    await expect(page.locator('input[aria-label="Alpha"]')).toBeVisible();
});

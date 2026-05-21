import { test, expect } from '@playwright/test';

test('accordion single-mode: expanding one item collapses the previously expanded one', async ({ page }) => {
    await page.goto('/');

    // Both contents hidden initially.
    await expect(page.getByTestId('single-content-a')).toBeHidden();
    await expect(page.getByTestId('single-content-b')).toBeHidden();

    await page.getByTestId('single-trigger-a').click();
    await expect(page.getByTestId('single-content-a')).toBeVisible();
    await expect(page.getByTestId('single-content-b')).toBeHidden();

    // Expanding B must collapse A (single mode).
    await page.getByTestId('single-trigger-b').click();
    await expect(page.getByTestId('single-content-b')).toBeVisible();
    await expect(page.getByTestId('single-content-a')).toBeHidden();
});

test('accordion multiple-mode: items expand independently', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('multi-content-x')).toBeHidden();
    await expect(page.getByTestId('multi-content-y')).toBeHidden();

    await page.getByTestId('multi-trigger-x').click();
    await expect(page.getByTestId('multi-content-x')).toBeVisible();

    await page.getByTestId('multi-trigger-y').click();
    // Both are open simultaneously in multiple mode.
    await expect(page.getByTestId('multi-content-x')).toBeVisible();
    await expect(page.getByTestId('multi-content-y')).toBeVisible();

    // Clicking X again collapses just X.
    await page.getByTestId('multi-trigger-x').click();
    await expect(page.getByTestId('multi-content-x')).toBeHidden();
    await expect(page.getByTestId('multi-content-y')).toBeVisible();
});

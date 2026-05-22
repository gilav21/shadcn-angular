import { test, expect } from '@playwright/test';

test('eyedropper renders with accessible trigger', async ({ page }) => {
    await page.goto('/');
    const eyedropper = page.getByTestId('root');
    await expect(eyedropper).toBeVisible();

    const trigger = eyedropper.locator('button[data-slot="eyedropper-trigger"]');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-label', 'Pick color');
});

test('eyedropper trigger is enabled in Chromium (native EyeDropper available)', async ({ page }) => {
    await page.goto('/');
    const trigger = page.locator('button[data-slot="eyedropper-trigger"]');
    await expect(trigger).toBeEnabled();
});

test('eyedropper trigger becomes disabled when EyeDropper API is removed', async ({ page }) => {
    await page.addInitScript(() => {
        Reflect.deleteProperty(window, 'EyeDropper');
    });
    await page.goto('/');
    const trigger = page.locator('button[data-slot="eyedropper-trigger"]');
    await expect(trigger).toBeDisabled();
    await expect(trigger).toHaveAttribute('title', /not supported/i);
});

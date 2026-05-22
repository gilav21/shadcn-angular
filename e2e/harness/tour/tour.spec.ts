import { test, expect } from '@playwright/test';

test('tour advances through steps via Next and finishes', async ({ page }) => {
    await page.goto('/');

    // Tour inactive — neither step's title appears.
    await expect(page.locator('text=First step')).toBeHidden();

    // Start the tour. First step card should appear near step-one target.
    await page.getByTestId('start').click();
    await expect(page.locator('text=First step').first()).toBeVisible();

    // Click Next to advance to the second step.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('text=Second step').first()).toBeVisible();
    await expect(page.locator('text=First step')).toBeHidden();

    // The final step shows "Done" (the configured finishLabel) instead
    // of Next. Clicking it ends the tour.
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('text=Second step')).toBeHidden();
});

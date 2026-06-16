import { test, expect } from '@playwright/test';

test('toast fires from a service and renders its title + description', async ({ page }) => {
    await page.goto('/');

    // Count the rendered toasts structurally — robust against text-substring matches.
    const toasts = page.locator('[data-slot="toast"]');
    await expect(toasts).toHaveCount(0);

    await page.getByTestId('fire').click();

    // Wait for the first toast to be in the DOM before firing again, so a slow
    // runner can't drop the second click into the gap before the first render.
    await expect(toasts).toHaveCount(1);
    await expect(page.locator('[data-slot="toast-title"]').first()).toHaveText('Saved');
    await expect(page.locator('[data-slot="toast-description"]').first()).toHaveText(
        'Your changes have been saved.',
    );

    // Firing again stacks a second toast.
    await page.getByTestId('fire').click();
    await expect(toasts).toHaveCount(2);
});

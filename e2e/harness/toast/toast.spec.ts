import { test, expect } from '@playwright/test';

test('toast fires from a service and renders its title + description', async ({ page }) => {
    await page.goto('/');

    // No toast in the DOM initially.
    await expect(page.locator('text=Saved')).toBeHidden();

    await page.getByTestId('fire').click();

    // The toast renders inside <ui-toaster>; locate by visible text.
    await expect(page.locator('text=Saved').first()).toBeVisible();
    await expect(page.locator('text=Your changes have been saved.').first()).toBeVisible();

    // Firing again stacks a second toast.
    await page.getByTestId('fire').click();
    await expect(page.locator('text=Saved')).toHaveCount(2);
});

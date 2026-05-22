import { test, expect } from '@playwright/test';

test('carousel renders slides and navigates via prev/next', async ({ page }) => {
    await page.goto('/');

    // All three slides exist in DOM; only the active one is visible
    // (the others are clipped by the carousel's track).
    await expect(page.getByTestId('slide-1')).toBeVisible();

    // Click next; second slide should now be in view.
    await page.getByTestId('next').locator('button').click();
    await expect(page.getByTestId('slide-2')).toBeVisible();

    // Prev returns to slide 1.
    await page.getByTestId('prev').locator('button').click();
    await expect(page.getByTestId('slide-1')).toBeVisible();
});

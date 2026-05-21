import { test, expect } from '@playwright/test';

test('hover-card reveals content on hover and dismisses on leave', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('card-body')).toBeHidden();

    await page.getByTestId('trigger').hover();
    await expect(page.getByTestId('card-body')).toBeVisible();

    // Move pointer well away from the card.
    await page.mouse.move(0, 0);
    await expect(page.getByTestId('card-body')).toBeHidden();
});

import { test, expect } from '@playwright/test';

test('checkbox toggles on click', async ({ page }) => {
    await page.goto('/');
    const cb = page.getByTestId('cb').locator('input[type="checkbox"]').first();
    await expect(cb).toBeVisible();
    await expect(page.getByTestId('state')).toHaveText('unchecked');

    await cb.click();
    await expect(page.getByTestId('state')).toHaveText('checked');

    await cb.click();
    await expect(page.getByTestId('state')).toHaveText('unchecked');
});

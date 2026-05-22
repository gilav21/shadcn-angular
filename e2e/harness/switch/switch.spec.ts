import { test, expect } from '@playwright/test';

test('switch toggles on click', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('state')).toHaveText('off');

    const sw = page.getByTestId('switch').locator('button, [role="switch"]').first();
    await expect(sw).toBeVisible();

    await sw.click();
    await expect(page.getByTestId('state')).toHaveText('on');

    await sw.click();
    await expect(page.getByTestId('state')).toHaveText('off');
});

import { test, expect } from '@playwright/test';

test('popover toggles open/closed on trigger click', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByTestId('trigger');
    await expect(trigger).toBeVisible();
    await expect(page.getByTestId('content')).toBeHidden();

    await trigger.click();
    await expect(page.getByTestId('content')).toBeVisible();
    await expect(page.getByTestId('content')).toContainText('Hello popover');

    await page.mouse.click(10, 10);
    await expect(page.getByTestId('content')).toBeHidden();
});

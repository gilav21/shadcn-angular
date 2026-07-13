import { test, expect } from '@playwright/test';

test('kanban renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

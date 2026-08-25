import { test, expect } from '@playwright/test';

test('banner renders its message and spans the container', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByTestId('root');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Scheduled maintenance at 02:00 UTC.');
});

test('banner announces politely, and only destructive escalates to alert', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toHaveAttribute('role', 'status');
    await expect(page.getByTestId('destructive')).toHaveAttribute('role', 'alert');
});

test('projected content replaces the message input', async ({ page }) => {
    await page.goto('/');
    const projected = page.getByTestId('projected');
    await expect(projected).toContainText('Trial ends in 3 days.');
    await expect(projected).not.toContainText('ignored input message');
});

test('the dismiss control hides the banner', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByTestId('root');
    await banner.locator('[data-slot="banner-dismiss"] button').click();
    await expect(banner).toBeHidden();
});

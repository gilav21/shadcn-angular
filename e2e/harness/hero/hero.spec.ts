import { test, expect } from '@playwright/test';

// T-8 — primary and secondary CTAs are clickable and emit distinctly.
test('hero: both CTAs are clickable and emit their own event', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.getByTestId('clicked')).toHaveText('none');

    await page.getByRole('button', { name: 'Get started' }).click();
    await expect(page.getByTestId('clicked')).toHaveText('primary');

    await page.getByRole('button', { name: 'Learn more' }).click();
    await expect(page.getByTestId('clicked')).toHaveText('secondary');
});

test('hero: inputs override the default copy', async ({ page }) => {
    await page.goto('/');

    const custom = page.getByTestId('custom');
    await expect(custom.getByRole('heading')).toHaveText('Custom headline');
    await expect(custom.getByRole('button', { name: 'Buy now' })).toBeVisible();
    await expect(custom.getByRole('button', { name: 'Read docs' })).toBeVisible();

    // An empty eyebrow suppresses the badge entirely.
    await expect(custom.locator('[data-slot="badge"]')).toHaveCount(0);
    await expect(page.getByTestId('root').locator('[data-slot="badge"]')).toHaveText('New');
});

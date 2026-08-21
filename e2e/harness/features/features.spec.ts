import { test, expect } from '@playwright/test';

const DEFAULT_TITLES = [
    'Blazing fast',
    'Accessible by default',
    'Fully themeable',
    'You own the code',
    'Polished details',
    'Ready to ship',
];

// T-9 — all feature items render, each with its icon and description.
test('features: every default feature item renders', async ({ page }) => {
    await page.goto('/');
    const root = page.getByTestId('root');
    await expect(root).toBeVisible();

    await expect(root.locator('[data-slot="card"]')).toHaveCount(DEFAULT_TITLES.length);

    for (const title of DEFAULT_TITLES) {
        await expect(root.getByRole('heading', { name: title })).toBeVisible();
    }

    // One icon per card. `ui-icon` renders an EMPTY <svg> for an unknown name
    // rather than throwing, so counting <svg> elements would not catch a typo'd
    // IconName — assert the per-name `ui-icon-<name>` hook instead.
    await expect(root.locator('[data-slot="icon"]')).toHaveCount(DEFAULT_TITLES.length);
    for (const icon of ['zap', 'shield-check', 'palette', 'code', 'sparkles', 'rocket']) {
        await expect(root.locator(`.ui-icon-${icon}`)).toHaveCount(1);
    }

    // Every card carries a non-empty description.
    const descriptions = root.locator('[data-slot="card-content"] p');
    await expect(descriptions).toHaveCount(DEFAULT_TITLES.length);
    for (const text of await descriptions.allTextContents()) {
        expect(text.trim().length).toBeGreaterThan(0);
    }
});

test('features: the items input replaces the defaults', async ({ page }) => {
    await page.goto('/');
    const custom = page.getByTestId('custom');

    await expect(custom.getByRole('heading', { name: 'Just two' })).toBeVisible();
    await expect(custom.locator('[data-slot="card"]')).toHaveCount(2);
    await expect(custom.getByRole('heading', { name: 'One' })).toBeVisible();
    await expect(custom.getByRole('heading', { name: 'Blazing fast' })).toHaveCount(0);
});

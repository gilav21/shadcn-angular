import { test, expect } from '@playwright/test';

// T-7 — every plan CTA is clickable AND emits. Before this spec existed the
// CTAs were `<ui-button [label]="tier.cta" />` with no handler at all: they
// rendered, they compiled, and clicking them did nothing.
const PLANS = [
    { cta: 'Get started', expected: 'Free|$0' },
    { cta: 'Start free trial', expected: 'Pro|$19' },
    { cta: 'Contact sales', expected: 'Enterprise|Custom' },
];

test('pricing: every plan CTA emits its own tier', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.getByTestId('cta-count')).toHaveText('0');

    let clicks = 0;
    for (const plan of PLANS) {
        await page.getByRole('button', { name: plan.cta }).click();
        clicks++;
        await expect(page.getByTestId('picked')).toHaveText(plan.expected);
        await expect(page.getByTestId('cta-count')).toHaveText(String(clicks));
    }
});

test('pricing: all three tiers render with their prices and features', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('[data-slot="card"]')).toHaveCount(3);

    for (const name of ['Free', 'Pro', 'Enterprise']) {
        await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
    for (const price of ['$0', '$19', 'Custom']) {
        await expect(page.getByText(price, { exact: true })).toBeVisible();
    }

    // The highlighted plan carries its badge.
    await expect(page.getByText('Popular', { exact: true })).toBeVisible();

    // Feature lists: 3 + 4 + 4 bullets across the three cards.
    await expect(page.locator('[data-slot="pricing-block"] li')).toHaveCount(11);
});

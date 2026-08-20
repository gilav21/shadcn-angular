import { test, expect } from '@playwright/test';

const STATS = [
    { label: 'Revenue', value: '$45,231', delta: '+12.5%' },
    { label: 'Active users', value: '2,340', delta: '+8.1%' },
    { label: 'Orders', value: '1,210', delta: '-3.2%' },
    { label: 'Churn rate', value: '1.8%', delta: '-0.4%' },
];

// Scoped to the first grid: "Revenue" is BOTH a stat label and the chart card's
// title, so an unscoped getByText would be ambiguous.
const STAT_CARDS = '[data-slot="dashboard-block"] > div:first-child [data-slot="card"]';

// T-4 — stat tiles render their values; the chart actually renders.
test('dashboard: every stat tile renders its label, value and delta in order', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();

    const cards = page.locator(STAT_CARDS);
    await expect(cards).toHaveCount(STATS.length);

    for (const [i, stat] of STATS.entries()) {
        const card = cards.nth(i);
        await expect(card.locator('[data-slot="card-description"]')).toHaveText(stat.label);
        await expect(card.locator('[data-slot="card-title"]')).toHaveText(stat.value);
        await expect(card.locator('[data-slot="badge"]')).toHaveText(stat.delta);
    }

    // A negative delta must be styled destructively, a positive one must not.
    await expect(cards.nth(2).locator('[data-slot="badge"]')).toHaveClass(/destructive/);
    await expect(cards.nth(0).locator('[data-slot="badge"]')).not.toHaveClass(/destructive/);
});

test('dashboard: the bar chart renders one bar per data point with real geometry', async ({ page }) => {
    await page.goto('/');

    const chart = page.locator('ui-bar-chart');
    await expect(chart).toBeVisible();

    const svg = chart.locator('svg').first();
    await expect(svg).toBeVisible();

    // A chart that rendered an empty SVG would still be "visible" — assert the
    // bars exist, which only happens once the component has measured its
    // container and scaled the six data points.
    expect(await svg.locator('rect').count()).toBeGreaterThanOrEqual(6);

    const box = await svg.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);
});

test('dashboard: the activity table renders a row per entry', async ({ page }) => {
    await page.goto('/');

    for (const head of ['User', 'Activity', 'When']) {
        await expect(page.locator('[data-slot="table-head"]', { hasText: head })).toBeVisible();
    }

    await expect(page.locator('[data-slot="table-body"] [data-slot="table-row"]')).toHaveCount(4);
    await expect(page.getByText('Ada Lovelace', { exact: true })).toBeVisible();
    await expect(page.getByText('Upgraded to Pro', { exact: true })).toBeVisible();

    // Each row shows an avatar fallback with the person's initials.
    await expect(page.locator('[data-slot="avatar-fallback"]')).toHaveCount(4);
});

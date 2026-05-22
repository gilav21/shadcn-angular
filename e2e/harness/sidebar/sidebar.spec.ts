import { test, expect } from '@playwright/test';

test('sidebar collapses to icon mode when toggle is clicked', async ({ page }) => {
    await page.goto('/');

    // Header text is visible while expanded.
    await expect(page.getByTestId('sidebar-header')).toBeVisible();
    await expect(page.getByTestId('item-home')).toBeVisible();

    // The sidebar's host width tells us the expanded vs collapsed state.
    // Capture it before toggling.
    // <ui-sidebar> host has class="contents"; the rendered <aside>
    // inside is the actual layout element.
    const sidebar = page.locator('aside[data-slot="sidebar"]').first();
    const expandedWidth = (await sidebar.boundingBox())?.width ?? 0;
    expect(expandedWidth).toBeGreaterThan(120);

    // Toggle to icon mode.
    await page.getByTestId('trigger').click();

    // After collapsing to icon mode the sidebar's width must shrink
    // (icon-only is ~60px in the source).
    await expect(async () => {
        const w = (await sidebar.boundingBox())?.width ?? 0;
        expect(w).toBeLessThan(expandedWidth);
    }).toPass({ timeout: 2000 });

    // Toggle back: width returns to roughly the expanded size.
    await page.getByTestId('trigger').click();
    await expect(async () => {
        const w = (await sidebar.boundingBox())?.width ?? 0;
        expect(w).toBeGreaterThanOrEqual(expandedWidth - 5);
    }).toPass({ timeout: 2000 });
});

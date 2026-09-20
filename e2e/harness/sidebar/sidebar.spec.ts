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

test('nested sub-menu collapses, stays in the DOM, and leaves the tab order', async ({ page }) => {
    await page.goto('/');

    const sub = page.locator('[data-slot="sidebar-menu-sub"]').first();
    const list = sub.locator('ul').first();
    const trigger = page.getByTestId('sub-trigger');

    // Open by default: rows are visible and reachable.
    await expect(page.getByTestId('sub-alpha')).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const openHeight = (await list.boundingBox())?.height ?? 0;
    expect(openHeight).toBeGreaterThan(20);

    await trigger.click();

    // Closed: clipped to zero height...
    await expect(async () => {
        const h = (await sub.boundingBox())?.height ?? 0;
        expect(h).toBeLessThan(4);
    }).toPass({ timeout: 2000 });

    // ...but still rendered, which is what lets the collapse animate...
    await expect(list).toHaveCount(1);
    expect(await list.locator('[data-slot="sidebar-menu-sub-button"]').count()).toBe(2);

    // ...and inert, so it is out of the tab order and the a11y tree.
    await expect(list).toHaveAttribute('inert', '');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('sub-alpha')).toBeHidden();

    await trigger.click();
    await expect(page.getByTestId('sub-alpha')).toBeVisible();
});

test('row action fires without activating the row, and the badge renders', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('badge')).toHaveText('7');

    const action = page.getByTestId('action');
    await expect(action).toHaveAttribute('aria-label', 'Settings options');
    await action.click();

    // The action must not have navigated or toggled anything behind it.
    await expect(page.getByTestId('main-content')).toBeVisible();
});

test('rail toggles the sidebar and exposes its state', async ({ page }) => {
    await page.goto('/');

    const sidebar = page.locator('aside[data-slot="sidebar"]').first();
    const rail = page.getByTestId('rail');

    await expect(rail).toHaveAttribute('aria-expanded', 'true');
    const expanded = (await sidebar.boundingBox())?.width ?? 0;

    await rail.click();

    await expect(async () => {
        const w = (await sidebar.boundingBox())?.width ?? 0;
        expect(w).toBeLessThan(expanded);
    }).toPass({ timeout: 2000 });
    await expect(rail).toHaveAttribute('aria-expanded', 'false');
});

test('the menu never declares ARIA menu roles', async ({ page }) => {
    await page.goto('/');

    const sidebar = page.locator('aside[data-slot="sidebar"]').first();
    expect(await sidebar.locator('[role="menu"]').count()).toBe(0);
    expect(await sidebar.locator('[role="menuitem"]').count()).toBe(0);
    expect(await sidebar.locator('[role="menubar"]').count()).toBe(0);
});

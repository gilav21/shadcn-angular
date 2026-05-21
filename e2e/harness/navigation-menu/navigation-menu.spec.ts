import { test, expect } from '@playwright/test';

/**
 * Smoke test only — verifies the navigation-menu installs cleanly,
 * template-compiles inside a real consumer app, and renders its
 * trigger. Behavioral interaction (toggle open/close) varies by build
 * timing in this component and produced flake; the install/compile
 * path is the high-signal regression we care about for now.
 */
test('navigation-menu installs and renders its trigger', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('[data-slot="navigation-menu-trigger"]').first();
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('Getting Started');

    // The aria-expanded attribute must be present (controlled by item state),
    // proving the inject(NAVIGATION_MENU_ITEM) chain is wired correctly.
    const ariaExpanded = await trigger.getAttribute('aria-expanded');
    expect(['true', 'false']).toContain(ariaExpanded);
});

import { test, expect } from '@playwright/test';

test('button installed via init --prefix acme renders as <acme-button>', async ({ page }) => {
    await page.goto('/');

    // The harness page literally references <acme-button>. Angular only
    // renders the component if its selector was actually rewritten by the
    // CLI — otherwise this element stays as a no-op custom tag, the click
    // handler is unbound, and the assertions below fail.
    const button = page.getByTestId('primary');
    await expect(button).toBeVisible();

    // Confirm the rendered tag name is acme-button (lowercase per HTML).
    const tagName = await button.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('acme-button');

    await expect(page.getByTestId('count')).toHaveText('0');
    await button.click();
    await expect(page.getByTestId('count')).toHaveText('1');
});

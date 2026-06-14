import { test, expect } from '@playwright/test';

test('progress bar reflects value via the native <progress> element', async ({ page }) => {
    await page.goto('/');

    // Progress is backed by a native <progress> (role="progressbar"); the value
    // lives on the element's `value` property, not aria-valuenow. The element is
    // screen-reader-only (sr-only), so we assert on its property, not visibility.
    const bar = page.getByRole('progressbar').first();
    await expect(bar).toHaveJSProperty('value', 25);

    await page.getByTestId('bump').click();
    await expect(bar).toHaveJSProperty('value', 50);

    await page.getByTestId('bump').click();
    await expect(bar).toHaveJSProperty('value', 75);
});

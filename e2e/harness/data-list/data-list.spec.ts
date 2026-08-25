import { test, expect } from '@playwright/test';

test('data-list renders a real dl with dt/dd pairs', async ({ page }) => {
    await page.goto('/');
    const list = page.getByTestId('root');
    await expect(list).toBeVisible();
    await expect(list.locator('dl')).toHaveCount(1);
    await expect(list.locator('dt')).toHaveCount(3);
    await expect(list.locator('dd')).toHaveCount(3);
});

test('simple and projected rows appear in the same list', async ({ page }) => {
    await page.goto('/');
    const terms = page.getByTestId('root').locator('dt');
    await expect(terms).toHaveText(['Status', 'Plan', 'Owner']);
});

test('projected content lands inside its dd', async ({ page }) => {
    await page.goto('/');
    const value = page.getByTestId('owner-value');
    await expect(value).toBeVisible();
    await expect(
        page.getByTestId('root').locator('dd', { has: page.getByTestId('owner-value') })
    ).toHaveCount(1);
});

/**
 * `dt`/`dd` must be DIRECT children of the `dl`, with no wrapper element in
 * between.
 *
 * This test previously asserted that a `ui-data-list-item` host sat inside the
 * `dl` carrying `display: contents`. That was wrong, and asserting it pinned a
 * real a11y bug: the `definition-list` and `dlitem` rules inspect the **DOM
 * tree**, not the accessibility tree, so a projected host between `dl` and
 * `dt` is a *serious* violation no matter what it computes to. Rows are now
 * stamped into the `dl` through `ngTemplateOutlet`, so no wrapper host enters
 * the document at all — and this asserts that end state directly.
 */
test('dt and dd are direct children of the dl, with no wrapper host between', async ({ page }) => {
    await page.goto('/');

    const parentTags = await page.getByTestId('root').locator('dl > *').evaluateAll(
        (nodes) => nodes.map((node) => node.tagName)
    );
    expect(parentTags).toEqual(['DT', 'DD', 'DT', 'DD', 'DT', 'DD']);

    // Positive control: the assertion above is only meaningful if a stray
    // wrapper WOULD be caught, so prove the query sees every element child.
    expect(parentTags).toHaveLength(6);

    // And nothing named like a row wrapper survives anywhere inside the list.
    await expect(page.getByTestId('root').locator('dl ui-data-list-item')).toHaveCount(0);
});

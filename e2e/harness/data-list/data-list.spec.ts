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

test('projected rows stay accessible children of the dl (display: contents)', async ({ page }) => {
    await page.goto('/');
    const row = page.getByTestId('data-list-item');
    await expect(row).toHaveCSS('display', 'contents');

    const parentTag = await row.evaluate((el) => el.parentElement?.tagName);
    expect(parentTag).toBe('DL');
});

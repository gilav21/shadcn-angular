import { test, expect } from '@playwright/test';

test('page-header renders the title as an h1 and the description below it', async ({ page }) => {
    await page.goto('/');
    const header = page.getByTestId('root');
    await expect(header).toBeVisible();
    await expect(header.locator('h1')).toHaveText('Invoices');
    await expect(header.locator('[data-slot="page-header-description"]')).toHaveText(
        'Everything billed this quarter.'
    );
});

test('projected actions land in the actions slot', async ({ page }) => {
    await page.goto('/');
    const actions = page.getByTestId('root').locator('[data-slot="page-header-actions"]');
    await expect(actions.getByTestId('action')).toBeVisible();
});

test('headingLevel changes the element, not the look', async ({ page }) => {
    await page.goto('/');
    const secondary = page.getByTestId('level-two');
    await expect(secondary.locator('h2')).toHaveText('Team members');
    await expect(secondary.locator('h1')).toHaveCount(0);
});

test('the breadcrumb slot costs no space when nothing is projected', async ({ page }) => {
    await page.goto('/');
    const slot = page.getByTestId('root').locator('[data-slot="page-header-breadcrumb"]');
    await expect(slot).toBeHidden();
});

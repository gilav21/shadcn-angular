import { test, expect } from '@playwright/test';

const Q1 = 'How do I install a component?';
const Q2 = 'Do I own the code, or is it a dependency?';
const A1 = /Use the CLI to add any component/;
const A2 = /You own it\./;

// T-10 — clicking a question expands its answer.
test('faq: clicking a question expands its answer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();

    // Everything starts collapsed.
    await expect(page.getByText(A1)).toBeHidden();

    await page.getByRole('button', { name: Q1 }).click();
    await expect(page.getByText(A1)).toBeVisible();

    // Clicking the same question again collapses it.
    await page.getByRole('button', { name: Q1 }).click();
    await expect(page.getByText(A1)).toBeHidden();
});

test('faq: it is single-mode — opening one answer closes the previous', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: Q1 }).click();
    await expect(page.getByText(A1)).toBeVisible();

    await page.getByRole('button', { name: Q2 }).click();
    await expect(page.getByText(A2)).toBeVisible();
    await expect(page.getByText(A1)).toBeHidden();
});

test('faq: renders the heading and every question', async ({ page }) => {
    await page.goto('/');
    const root = page.getByTestId('root');

    await expect(root.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible();
    await expect(root.locator('[data-slot="accordion-item"]')).toHaveCount(5);
});

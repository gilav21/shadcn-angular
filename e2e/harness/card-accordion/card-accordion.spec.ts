import { test, expect } from '@playwright/test';

test('card-accordion renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

test('toggles a panel open and rotates the chevron', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByTestId('trigger-one').locator('button');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('content-one')).toBeVisible();
    await expect(trigger.locator('svg')).toHaveClass(/rotate-180/);
});

test('single mode closes the previous panel', async ({ page }) => {
    await page.goto('/');

    const first = page.getByTestId('trigger-one').locator('button');
    const second = page.getByTestId('trigger-two').locator('button');

    await first.click();
    await second.click();

    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(second).toHaveAttribute('aria-expanded', 'true');
});

test('header action click does not toggle the panel', async ({ page }) => {
    await page.goto('/');

    const trigger = page.getByTestId('trigger-one').locator('button');
    await page.getByTestId('action-one').click();

    await expect(page.getByTestId('action-count')).toHaveText('1');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('multiple mode keeps several panels open', async ({ page }) => {
    await page.goto('/');

    const root = page.getByTestId('multiple-root');
    const triggers = root.locator('[data-slot="card-accordion-trigger"]');

    await triggers.nth(0).click();
    await triggers.nth(1).click();

    await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
});

import { test, expect } from '@playwright/test';

const toggle = (id: string) => `[data-testid="${id}"] [data-slot="card-accordion-trigger"]`;

test('card-accordion renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

test('toggles a panel open and rotates the chevron', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator(toggle('trigger-one'));
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('content-one')).toBeVisible();
    await expect(page.getByTestId('trigger-one').locator('svg')).toHaveClass(/rotate-180/);
});

test('single mode closes the previous panel', async ({ page }) => {
    await page.goto('/');

    const first = page.locator(toggle('trigger-one'));
    const second = page.locator(toggle('trigger-two'));

    await first.click();
    await second.click();

    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(second).toHaveAttribute('aria-expanded', 'true');
});

test('header action click does not toggle the panel', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator(toggle('trigger-one'));
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

import { test, expect } from '@playwright/test';

test('tour advances through steps via Next and finishes', async ({ page }) => {
    await page.goto('/');

    // Tour inactive — neither step's title appears.
    await expect(page.locator('text=First step')).toBeHidden();

    // Start the tour. First step card should appear near step-one target.
    await page.getByTestId('start').click();
    await expect(page.locator('text=First step').first()).toBeVisible();

    // Click Next to advance to the second step.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('text=Second step').first()).toBeVisible();
    await expect(page.locator('text=First step')).toBeHidden();

    // The final step shows "Done" (the configured finishLabel) instead
    // of Next. Clicking it ends the tour.
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('text=Second step')).toBeHidden();
});

test('beforeActivate opens a panel and the tour waits for the element it renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('panel')).toBeHidden();

    await page.getByTestId('start-async').click();
    await expect(page.locator('text=Async intro').first()).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();

    // The panel did not exist when the step began — beforeActivate created it
    // and the tour waited before highlighting.
    await expect(page.getByTestId('panel')).toBeVisible();
    await expect(page.locator('text=Panel step').first()).toBeVisible();
    await expect(page.getByTestId('panel')).toHaveAttribute('data-ui-tour-highlight', '');
});

test('a step whose target does not exist is skipped forwards and backwards', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-async').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('text=Panel step').first()).toBeVisible();

    // The row step's target is absent (the list is empty), so Next jumps
    // straight past it to the final step instead of breaking the tour.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('text=Async outro').first()).toBeVisible();
    await expect(page.getByTestId('skipped')).toHaveText('2:missing-target');

    // Going back must skip it too, landing on the panel step rather than
    // bouncing forward or ending the tour.
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.locator('text=Panel step').first()).toBeVisible();
    await expect(page.getByTestId('skipped')).toHaveText('2:missing-target,2:missing-target');
});

test('an unreachable first step leaves no dead Back button or phantom count', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-dead-end').click();

    // Step 0's target never exists, so the tour opens on step 1 — and must not
    // offer a Back button that would go nowhere.
    await expect(page.locator('text=Dead-end second').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous' })).toHaveCount(0);

    // ...nor promise a step the user can never reach.
    await expect(page.locator('[data-slot="tour-card"]')).toContainText('1 / 1');
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
});

test('the skipped step is shown once its target exists', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('add-row').click();
    await expect(page.getByTestId('row')).toBeVisible();

    await page.getByTestId('start-async').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('text=Panel step').first()).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('text=Row step').first()).toBeVisible();
    await expect(page.getByTestId('skipped')).toHaveText('');
});

test('the overlay stays up and the card reports progress while a hook runs', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('slow-mode').click();
    await page.getByTestId('start-async').click();
    await expect(page.locator('text=Async intro').first()).toBeVisible();

    await page.getByRole('button', { name: 'Next' }).click();

    // Mid-hook: the viewport stays dimmed by the scrim, the card is still on
    // screen marked busy, and Next/Previous are disabled.
    const card = page.locator('[data-slot="tour-card"]');
    await expect(card).toHaveAttribute('data-pending', '');
    await expect(page.locator('[data-slot="tour-scrim"]')).toBeVisible();
    await expect(card).toBeVisible();
    await expect(card.locator('[data-slot="tour-pending"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();

    // The scrim really covers the viewport — asserted, not eyeballed.
    expect(await page.locator('[data-slot="tour-scrim"]').boundingBox())
        .toEqual({ x: 0, y: 0, width: 1280, height: 720 });

    // ...and it resolves normally afterwards.
    await expect(page.locator('text=Panel step').first()).toBeVisible({ timeout: 5000 });
    await expect(card).not.toHaveAttribute('data-pending', '');
});

test('afterDeactivate closes the panel when stepping backwards', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('add-row').click();

    await page.getByTestId('start-async').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByTestId('panel')).toBeVisible();

    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(page.locator('text=Async intro').first()).toBeVisible();
    await expect(page.getByTestId('panel')).toBeHidden();
});

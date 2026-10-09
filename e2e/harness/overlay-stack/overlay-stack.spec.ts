import { test, expect, type Page } from '@playwright/test';

const dialogPanel = (page: Page) => page.locator('[data-slot="dialog-content"]');
const confirmPanel = (page: Page) => page.locator('[data-slot="alert-dialog-content"]');
const listbox = (page: Page) => page.locator('[role="listbox"]');
const calendar = (page: Page) => page.locator('ui-calendar');

async function openForm(page: Page): Promise<void> {
    await page.goto('/');
    await page.getByTestId('open-dialog').locator('button').click();
    await expect(dialogPanel(page)).toBeVisible();
    await page.getByTestId('name').fill('Ada Lovelace');
}

test('Escape closes exactly the innermost layer, wherever focus is', async ({ page }) => {
    await openForm(page);

    await page.locator('button[role="combobox"]').click();
    await expect(listbox(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(listbox(page)).toBeHidden();
    await expect(dialogPanel(page)).toBeVisible();
    await expect(page.locator('button[role="combobox"]')).toBeFocused();

    await page.locator('[data-slot="date-picker"] > button').click();
    await expect(calendar(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(calendar(page)).toBeHidden();
    await expect(dialogPanel(page)).toBeVisible();

    await page.getByTestId('open-confirm').click();
    await expect(confirmPanel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(confirmPanel(page)).toBeHidden();
    await expect(dialogPanel(page)).toBeVisible();
    await expect(page.getByTestId('name')).toHaveValue('Ada Lovelace');

    await page.keyboard.press('Escape');
    await expect(dialogPanel(page)).toBeHidden();
});

test('Tab and Shift+Tab never leave the open modal', async ({ page }) => {
    await openForm(page);

    for (const key of ['Tab', 'Shift+Tab']) {
        for (let press = 0; press < 12; press++) {
            await page.keyboard.press(key);
            const inside = await page.evaluate(
                () => !!document.activeElement?.closest('[data-slot="dialog-content"]'),
            );
            expect(inside, `${key} press ${press + 1} left the dialog`).toBe(true);
        }
    }
});

test('the page behind a modal does not scroll, and scrolls again after the last one closes', async ({ page }) => {
    await openForm(page);
    await page.getByTestId('open-confirm').click();
    await expect(confirmPanel(page)).toBeVisible();

    await page.mouse.move(5, 5);
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    // Closing the alert dialog must not unlock the page: the dialog under it is still modal.
    await page.keyboard.press('Escape');
    await expect(confirmPanel(page)).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Escape');
    await expect(dialogPanel(page)).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

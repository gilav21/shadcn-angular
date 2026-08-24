import { test, expect } from '@playwright/test';

/**
 * These run against a REAL install in a pristine Angular app. They are the
 * gate between "the unit tests pass" and "a consumer can use this", and the
 * locale assertions additionally depend on the runtime's own ICU data rather
 * than on anything we ship.
 */
test.describe('currency-input', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('renders the amount formatted for its locale', async ({ page }) => {
        await expect(page.getByTestId('root').locator('input')).toHaveValue('$1,234.50');
    });

    test('formats the same amount the German way', async ({ page }) => {
        // Dot groups, comma decimal — the mirror image of en-US.
        await expect(page.getByTestId('german').locator('input')).toHaveValue(/1\.234,50/);
    });

    /** Yen has no minor unit; showing one would simply be wrong. */
    test('shows no decimal places for yen', async ({ page }) => {
        const value = await page.getByTestId('yen').locator('input').inputValue();
        expect(value).not.toContain('.');
        expect(value).toContain('1,235');
    });

    test('shows a plain number while being edited, and reformats on blur', async ({ page }) => {
        const field = page.getByTestId('root').locator('input');

        await field.click();
        await expect(field).toHaveValue('1234.5');

        await field.fill('99.5');
        await field.blur();
        await expect(field).toHaveValue('$99.50');
        await expect(page.getByTestId('value')).toHaveText('99.5');
    });

    test('rounds to the currency scale when the edit ends', async ({ page }) => {
        const field = page.getByTestId('root').locator('input');

        await field.click();
        await field.fill('12.345');
        await field.blur();

        await expect(page.getByTestId('value')).toHaveText('12.35');
    });

    /** Bounds wait for blur, or `250` would be unreachable by typing 2, 5, 0. */
    test('clamps to the bounds on blur, not while typing', async ({ page }) => {
        const field = page.getByTestId('bounded').locator('input');

        await field.click();
        await field.fill('250');
        await expect(page.getByTestId('bounded-value')).toHaveText('250');

        await field.blur();
        await expect(page.getByTestId('bounded-value')).toHaveText('100');
    });

    test('clears to null when emptied', async ({ page }) => {
        const field = page.getByTestId('root').locator('input');

        await field.click();
        await field.fill('');
        await field.blur();

        await expect(page.getByTestId('value')).toHaveText('null');
    });

    test('asks for a numeric keypad without being a number field', async ({ page }) => {
        const field = page.getByTestId('root').locator('input');
        await expect(field).toHaveAttribute('type', 'text');
        await expect(field).toHaveAttribute('inputmode', 'decimal');
    });
});

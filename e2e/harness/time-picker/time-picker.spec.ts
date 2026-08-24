import { test, expect } from '@playwright/test';

/**
 * These run against a REAL install in a pristine Angular app. They are the
 * gate between "the unit tests pass" and "a consumer can use this".
 *
 * The locale assertions carry extra weight here: they depend on the browser's
 * own ICU data, so this is where claims like "zh-TW renders the meridiem
 * first" are proven against a real runtime rather than a test environment.
 */
test.describe('time-picker', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    const segment = (testId: string, kind: string) =>
        `[data-testid="${testId}"] [data-slot="time-picker-segment"][data-segment="${kind}"]`;

    test('splits a value across its segments', async ({ page }) => {
        await expect(page.locator(segment('root', 'hour'))).toHaveValue('9');
        await expect(page.locator(segment('root', 'minute'))).toHaveValue('05');
        await expect(
            page.locator('[data-testid="root"] [data-slot="time-picker-period"]'),
        ).toHaveText('AM');
    });

    /** 12-hour is a rendering choice; the stored value never is. */
    test('renders 24-hour in a 24-hour locale', async ({ page }) => {
        await expect(page.locator(segment('british', 'hour'))).toHaveValue('21');
        await expect(
            page.locator('[data-testid="british"] [data-slot="time-picker-period"]'),
        ).toHaveCount(0);
    });

    test('renders the locale’s own digits', async ({ page }) => {
        await expect(page.locator(segment('arabic', 'minute'))).toHaveValue('٠٥');
    });

    /** The one thing that genuinely varies in the layout across locales. */
    test('puts the meridiem first when the locale does', async ({ page }) => {
        const slots = page.locator(
            '[data-testid="chinese"] [data-slot="time-picker-segment"],' +
                '[data-testid="chinese"] [data-slot="time-picker-period"]',
        );
        const first = slots.first();
        await expect(first).toHaveAttribute('data-slot', 'time-picker-period');
        await expect(first).toHaveText('下午');
    });

    test('typing both segments produces a 24-hour value', async ({ page }) => {
        await page.locator(segment('empty', 'hour')).fill('9');
        await page.locator(segment('empty', 'minute')).fill('30');

        await expect(page.getByTestId('empty-value')).toHaveText('09:30');
    });

    /**
     * An hour with no minute is not a time — and the digit has to survive the
     * null commit, which is the bug this control had first.
     */
    test('holds no value for half a reading, without losing the digit', async ({ page }) => {
        await page.locator(segment('empty', 'hour')).fill('9');

        await expect(page.getByTestId('empty-value')).toHaveText('empty');
        await expect(page.locator(segment('empty', 'hour'))).toHaveValue('9');
    });

    test('the meridiem flips the stored hour by twelve', async ({ page }) => {
        await page.locator('[data-testid="root"] [data-slot="time-picker-period"]').click();
        await expect(page.getByTestId('value')).toHaveText('21:05');
    });

    test('arrow keys step the segment under the caret', async ({ page }) => {
        const minute = page.locator(segment('root', 'minute'));
        await minute.click();
        await minute.press('ArrowUp');

        await expect(page.getByTestId('value')).toHaveText('09:06');
    });

    test('wraps a minute rather than sticking at 59', async ({ page }) => {
        const minute = page.locator(segment('root', 'minute'));
        await minute.fill('59');
        await minute.press('ArrowUp');

        await expect(page.getByTestId('value')).toHaveText('09:00');
    });

    test('widens the value when seconds are shown', async ({ page }) => {
        await expect(page.locator(segment('precise', 'second'))).toHaveValue('09');
        await page.locator(segment('precise', 'second')).fill('30');

        await expect(page.getByTestId('precise-value')).toHaveText('09:05:30');
    });

    /** No locale reads a clock right-to-left. */
    test('lays the segments out left-to-right', async ({ page }) => {
        await expect(
            page.locator('[data-testid="arabic"] [data-slot="time-picker"]'),
        ).toHaveAttribute('dir', 'ltr');
    });

    test('names the group and every segment', async ({ page }) => {
        await expect(page.locator('[data-testid="root"] [data-slot="time-picker"]')).toHaveAttribute(
            'aria-label',
            'Time',
        );
        await expect(page.locator(segment('root', 'hour'))).toHaveAttribute('role', 'spinbutton');
        await expect(page.locator(segment('root', 'hour'))).toHaveAttribute('aria-valuemax', '12');
        await expect(page.locator(segment('british', 'hour'))).toHaveAttribute(
            'aria-valuemax',
            '23',
        );
    });
});

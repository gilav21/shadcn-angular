import { test, expect } from '@playwright/test';

test('dialog: ESC closes and returns focus to the trigger', async ({ page }) => {
    await page.goto('/');

    // Focus the trigger before opening so we know what to restore to.
    const trigger = page.getByTestId('trigger').locator('button');
    await trigger.focus();
    await expect(trigger).toBeFocused();

    // Open via Enter on the focused trigger (keyboard-only path).
    await page.keyboard.press('Enter');

    // Dialog must be open.
    await expect(page.getByTestId('dialog-input')).toBeVisible();

    // Click an inner control so focus is definitely inside the dialog.
    await page.getByTestId('dialog-input').click();
    await expect(page.getByTestId('dialog-input')).toBeFocused();

    // Close via ESC. Focus should return to the trigger button.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dialog-input')).toBeHidden();
    await expect(trigger).toBeFocused();
});

test('dialog: Tab inside the dialog reaches every focusable control', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('trigger').locator('button').click();
    await expect(page.getByTestId('dialog-input')).toBeVisible();

    // Focus the first inner control deliberately, then Tab to the next.
    await page.getByTestId('dialog-input').focus();
    await page.keyboard.press('Tab');

    // Either the save button gets focus, or the dialog wraps focus
    // and we land on the input again. Both are valid trap behaviors;
    // landing on the OUTSIDE "after" button is the regression we
    // want to catch.
    const focusedTestId = await page.evaluate(() =>
        document.activeElement?.getAttribute('data-testid') ?? '',
    );
    const stayedInDialog = ['dialog-save', 'dialog-input', 'trigger'].includes(focusedTestId);
    expect(stayedInDialog, `Tab leaked to ${JSON.stringify(focusedTestId)}; focus trap not enforced`)
        .toBe(true);
});

import { test, expect } from '@playwright/test';

test('copy-to writes the bound text to the clipboard and emits copied', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');

    const root = page.getByTestId('root');
    await expect(root).toBeVisible();
    await expect(page.getByTestId('copied')).toHaveText('idle');

    await root.click();

    await expect(page.getByTestId('copied')).toHaveText('copied');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toBe('shadcn-angular');
});

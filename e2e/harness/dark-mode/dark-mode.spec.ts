import { test, expect } from '@playwright/test';

test('toggling .dark on the root flips --background / --foreground', async ({ page }) => {
    await page.goto('/');

    const readBg = () => page.getByTestId('root').evaluate(el =>
        getComputedStyle(el).getPropertyValue('--background').trim(),
    );
    const readFg = () => page.getByTestId('root').evaluate(el =>
        getComputedStyle(el).getPropertyValue('--foreground').trim(),
    );

    await expect(page.getByTestId('state')).toHaveText('light');
    const lightBg = await readBg();
    const lightFg = await readFg();

    await page.getByTestId('toggle').click();
    await expect(page.getByTestId('state')).toHaveText('dark');

    const darkBg = await readBg();
    const darkFg = await readFg();

    // Variables must resolve to different values in each mode. We don't
    // assert exact colors — the theme can change — only that toggling
    // produced a difference.
    expect(darkBg).not.toBe(lightBg);
    expect(darkFg).not.toBe(lightFg);
});

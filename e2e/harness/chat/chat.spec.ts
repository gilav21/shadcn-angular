import { test, expect } from '@playwright/test';

test('chat renders a message list and appends the message the input sends', async ({ page }) => {
    await page.goto('/');

    const list = page.getByTestId('root');
    await expect(list).toBeVisible();
    await expect(list).toContainText('How can I help?');
    await expect(page.locator('[data-slot="chat-message"]')).toHaveCount(1);

    const input = page.getByTestId('chat-input').locator('input, textarea').first();
    await input.fill('Hello there');
    await input.press('Enter');

    await expect(page.locator('[data-slot="chat-message"]')).toHaveCount(2);
    await expect(list).toContainText('Hello there');
});

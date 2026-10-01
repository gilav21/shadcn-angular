import { test, expect } from '@playwright/test';

test('field-mapper links two columns by tap-tap and draws the line with its label', async ({ page }) => {
    await page.goto('/');
    const mapper = page.locator('[data-slot="field-mapper"]');
    await expect(mapper).toBeVisible();

    await mapper.getByRole('option', { name: /^customer_id/ }).click();
    await mapper.getByRole('option', { name: /^id,/ }).click();

    await expect(page.getByTestId('links')).toContainText('"endId": "id"');
    await expect(mapper.locator('[data-slot="field-mapper-line"]')).toHaveCount(1);
    await expect(mapper.locator('[data-slot="field-mapper-link-label"]')).toHaveText('customer_id = id');
    await expect(mapper.locator('[data-slot="field-mapper-live"]')).toHaveText(/customer_id linked to id/);
});

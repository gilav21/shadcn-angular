import { test, expect } from '@playwright/test';

test('masonry renders every item', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
    await expect(page.getByTestId('card')).toHaveCount(6);
});

test('items are laid out across three columns', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('card')).toHaveCount(6);

    const columnStarts = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="root"]')!;
        const base = root.getBoundingClientRect().left;
        return [...root.querySelectorAll('[data-testid="card"]')].map((el) =>
            Math.round(el.getBoundingClientRect().left - base)
        );
    });

    expect(new Set(columnStarts).size).toBe(3);
});

test('DOM order equals visual reading order — no item sits above an earlier one', async ({
    page,
}) => {
    await page.goto('/');
    await expect(page.getByTestId('card')).toHaveCount(6);

    const { ids, tops } = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="root"]')!;
        const base = root.getBoundingClientRect().top;
        const cards = [...root.querySelectorAll<HTMLElement>('[data-testid="card"]')];
        return {
            ids: cards.map((el) => el.dataset['cardId']),
            tops: cards.map((el) => Math.round(el.getBoundingClientRect().top - base)),
        };
    });

    expect(ids).toEqual(['1', '2', '3', '4', '5', '6']);
    for (let i = 1; i < tops.length; i++) {
        expect(tops[i]).toBeGreaterThanOrEqual(tops[i - 1]);
    }
});

test('the container is tall enough for the tallest column', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('card')).toHaveCount(6);

    const { containerHeight, lowestBottom } = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="root"]')!;
        const rect = root.getBoundingClientRect();
        const bottoms = [...root.querySelectorAll('[data-testid="card"]')].map(
            (el) => el.getBoundingClientRect().bottom - rect.top
        );
        return { containerHeight: rect.height, lowestBottom: Math.max(...bottoms) };
    });

    expect(containerHeight).toBeGreaterThanOrEqual(lowestBottom - 1);
});

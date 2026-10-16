import { test, expect } from '@playwright/test';

// Projection is structural, so it is asserted by DOM position: the fixture's
// Tailwind scanner ignores installed components, so no class-driven geometry
// would be meaningful here.
test('prefix-projection: <acme-result-detail> lands in the named slot', async ({ page }) => {
    await page.goto('/');

    const detail = page.getByTestId('detail');
    await expect(detail).toHaveText('Order #1042');

    const placement = await detail.evaluate((el) => {
        const result = el.closest('[data-slot="result"]');
        const actions = result?.querySelector('[data-slot="result-actions"]') ?? null;
        const action = document.querySelector('[data-testid="action"]');
        return {
            tag: el.localName,
            parentSlot: el.parentElement?.dataset['slot'] ?? null,
            insideActions: actions?.contains(el) ?? null,
            beforeActions: actions ? (el.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 : null,
            actionInActions: actions && action ? actions.contains(action) : null,
        };
    });

    expect(placement).toEqual({
        tag: 'acme-result-detail',
        parentSlot: 'result',
        insideActions: false,
        beforeActions: true,
        actionInActions: true,
    });
});

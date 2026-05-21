import { test, expect } from '@playwright/test';
import { injectAxe, getViolations } from 'axe-playwright';

/**
 * Known component-library a11y issues that this spec does NOT fail on
 * (they exist independent of this suite). The spec's job is to catch
 * NEW serious violations beyond this baseline, not to retroactively
 * gate on bugs that pre-date its existence.
 *
 * Each entry is the axe rule id. To investigate, open the harness in a
 * browser, run the axe DevTools extension, and follow the rule's
 * helpUrl. Remove an entry once the underlying component is fixed.
 */
const KNOWN_VIOLATIONS = new Set<string>([
    // ui-input doesn't forward `id` to its inner <input>, so the
    // explicit-label association on the OUTER ui-input element doesn't
    // reach the actual control. axe sees the inner <input> as unlabeled.
    'label',
    // ui-checkbox renders <button role="checkbox"> with no accessible
    // name (the label association is via for=id on a separate <ui-label>,
    // which axe can't see because of the same id-forwarding gap).
    'button-name',
]);

test('form built from shadcn components has no NEW serious/critical a11y violations', async ({ page }) => {
    await page.goto('/');
    await injectAxe(page);

    const violations = await getViolations(page, undefined, {
        axeOptions: {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        },
    });

    const newSerious = violations.filter(
        v => (v.impact === 'serious' || v.impact === 'critical') && !KNOWN_VIOLATIONS.has(v.id),
    );

    if (newSerious.length > 0) {
        console.log('\nNew serious/critical a11y violations (not in baseline):');
        for (const v of newSerious) {
            console.log(`  - [${v.impact}] ${v.id}: ${v.description}`);
            for (const node of v.nodes.slice(0, 3)) {
                console.log(`      target: ${node.target.join(', ')}`);
            }
        }
    }
    expect(newSerious).toHaveLength(0);
});

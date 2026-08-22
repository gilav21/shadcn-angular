import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * The gate between "unit tests pass" and "a consumer can install this".
 *
 * The unit suite drives synthetic PointerEvents against a TestBed. This drives
 * a real browser against the component installed the way `shadcn-angular add`
 * installs it — which is the only thing that proves the registry entry names
 * every file, that the barrel exports what the template needs, and that the
 * whole thing compiles outside the workspace's own path mapping.
 */

function port(page: Page, node: string, id: string): Locator {
    return page.locator(
        `[data-slot="node-editor-port"][data-node="${node}"][data-port="${id}"]`,
    );
}

function card(page: Page, node: string): Locator {
    return page.locator(`[data-slot="node-editor-node"][data-node="${node}"]`);
}

/** Drag one port onto another with real mouse events. */
async function dragPort(page: Page, from: Locator, to: Locator): Promise<void> {
    const start = await from.boundingBox();
    const end = await to.boundingBox();
    if (!start || !end) throw new Error('a port is not on screen');

    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    // An intermediate move: the editor only evaluates a drop target on move,
    // so going straight from down to up would never register one.
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
    await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('root')).toBeVisible();
});

test('renders a card and its ports for every node', async ({ page }) => {
    await expect(card(page, 'alpha')).toBeVisible();
    await expect(card(page, 'beta')).toBeVisible();
    await expect(port(page, 'alpha', 'out')).toBeVisible();
    await expect(port(page, 'beta', 'in')).toBeVisible();
    await expect(page.getByTestId('node-count')).toHaveText('2');
});

test('derives the node height from its ports', async ({ page }) => {
    // Both nodes were authored with height 0. If the derivation did not run,
    // the card would be zero-height and nothing would be clickable.
    const box = await card(page, 'alpha').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(40);
});

test('connects two ports by dragging between them', async ({ page }) => {
    await dragPort(page, port(page, 'alpha', 'out'), port(page, 'beta', 'in'));

    await expect(page.getByTestId('connection-count')).toHaveText('1');
    await expect(port(page, 'beta', 'in')).toHaveAttribute('data-connected', 'true');
});

test('refuses an invalid connection and states why', async ({ page }) => {
    // Same node: alpha.out -> alpha.in.
    await dragPort(page, port(page, 'alpha', 'out'), port(page, 'alpha', 'in'));

    await expect(page.getByTestId('connection-count')).toHaveText('0');
    await expect(page.getByTestId('rejection')).toHaveText('same-node');
});

test('refuses a connection that would close a cycle', async ({ page }) => {
    await dragPort(page, port(page, 'alpha', 'out'), port(page, 'beta', 'in'));
    await expect(page.getByTestId('connection-count')).toHaveText('1');

    await dragPort(page, port(page, 'beta', 'out'), port(page, 'alpha', 'in'));

    await expect(page.getByTestId('connection-count')).toHaveText('1');
    await expect(page.getByTestId('rejection')).toHaveText('cycle');
});

test('unplugs a connection by dragging its input end into empty space', async ({ page }) => {
    await dragPort(page, port(page, 'alpha', 'out'), port(page, 'beta', 'in'));
    await expect(page.getByTestId('connection-count')).toHaveText('1');

    const grab = await port(page, 'beta', 'in').boundingBox();
    // NOT getByTestId('root'): `ui-node-editor` is display:contents, so the
    // host element has no box at all. The editor's own root div does.
    const root = await page.locator('[data-slot="node-editor"]').boundingBox();
    if (!grab || !root) throw new Error('not on screen');

    await page.mouse.move(grab.x + grab.width / 2, grab.y + grab.height / 2);
    await page.mouse.down();
    await page.mouse.move(root.x + root.width - 30, root.y + root.height - 30, { steps: 8 });
    await page.mouse.up();

    await expect(page.getByTestId('connection-count')).toHaveText('0');
});

test('moves a node by dragging its card', async ({ page }) => {
    const before = await card(page, 'alpha').boundingBox();
    if (!before) throw new Error('not on screen');

    await page.mouse.move(before.x + before.width / 2, before.y + 12);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 90, before.y + 12, { steps: 8 });
    await page.mouse.up();

    const after = await card(page, 'alpha').boundingBox();
    expect(after?.x ?? 0).toBeGreaterThan(before.x + 60);
});

test('selects a node on click', async ({ page }) => {
    await card(page, 'alpha').click({ position: { x: 90, y: 12 } });
    await expect(card(page, 'alpha')).toHaveAttribute('data-selected', 'true');
});

test('mirrors the whole graph as text for screen readers', async ({ page }) => {
    const tree = page.locator('[data-slot="node-editor-a11y-tree"]');

    // Present in the accessibility tree, but not on screen.
    await expect(tree).toHaveCount(1);
    await expect(tree).toContainText('Alpha');
    await expect(tree).toContainText('Beta');
    await expect(tree).toContainText('not connected');

    await dragPort(page, port(page, 'alpha', 'out'), port(page, 'beta', 'in'));
    // Names what it connects TO, not merely that it is connected.
    await expect(tree).toContainText('Beta, in');
});

test('connects two ports from the keyboard alone', async ({ page }) => {
    // No mouse at all past this point: focus the card, cycle to its output,
    // start the connection, cross to the other node, commit.
    await card(page, 'alpha').focus();
    await page.keyboard.press('Tab');    // -> alpha.in
    await page.keyboard.press('Tab');    // -> alpha.out
    await page.keyboard.press('Enter');  // start

    await card(page, 'beta').focus();
    await page.keyboard.press('Tab');    // -> beta.in
    await page.keyboard.press('Enter');  // commit

    await expect(page.getByTestId('connection-count')).toHaveText('1');
});

test('moves a node with shift+arrow, and does not pan the view', async ({ page }) => {
    // Settle the layout before measuring: an unsettled first box was what made
    // an earlier version of this test fail intermittently.
    await expect(card(page, 'alpha')).toBeVisible();
    await card(page, 'alpha').focus();
    const before = await card(page, 'alpha').boundingBox();
    await expect(page.getByTestId('alpha-x')).toHaveText('40');

    await page.keyboard.press('Shift+ArrowRight');

    // Both halves matter, and they fail for different reasons.
    //
    // The WORLD position proves the nudge ran at all.
    await expect(page.getByTestId('alpha-x')).toHaveText('48');

    // The SCREEN position proves the engine did not ALSO pan. The engine binds
    // the arrow keys too, and its handler sits on a descendant of ours, so on
    // the bubble path it acted first: the node moved 8 units right in the graph
    // while the camera moved further right than that, leaving the card visibly
    // further LEFT. Asserting only the world position would pass while the
    // thing a user sees went the wrong way.
    const after = await card(page, 'alpha').boundingBox();
    expect(after?.x ?? 0).toBeGreaterThan(before?.x ?? 0);
});

test('deletes the selection with Delete', async ({ page }) => {
    await card(page, 'alpha').click({ position: { x: 90, y: 12 } });
    await page.keyboard.press('Delete');

    await expect(page.getByTestId('node-count')).toHaveText('1');
    await expect(card(page, 'alpha')).toHaveCount(0);
});

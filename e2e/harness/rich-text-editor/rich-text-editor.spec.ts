import { test, expect, type Page } from '@playwright/test';

// The BASE editor in a plain consumer install — `add rich-text-editor --yes`,
// nothing from `addons/`. Until this harness existed, refactoring the 4.6k-line
// editor was covered only by whichever addon spec happened to touch the same
// path. Each test drives a real browser at the installed component and asserts
// against BOTH the DOM and the bound model, because the ControlValueAccessor
// seam is exactly where a base refactor silently breaks.

/** `historyDebounceMs` defaults to 450 in the component; +100ms of slack. */
const HISTORY_DEBOUNCE_MS = 550;

const editable = (page: Page, testId = 'editor') =>
    page.locator(`[data-testid="${testId}"] [data-slot="rich-text-editor"]`);

test('renders the base editor with its docked toolbar', async ({ page }) => {
    await page.goto('/');

    await expect(editable(page)).toBeVisible();
    // The toolbar's built-in buttons come from the base's own table — no addon
    // installed, so no `data-addon-slot` button may appear anywhere.
    const toolbar = page.locator('[data-testid="editor"] [role="toolbar"]');
    await expect(toolbar.getByRole('button', { name: 'Bold (Ctrl+B)' })).toBeVisible();
    await expect(page.locator('[data-addon-slot]')).toHaveCount(0);

    await expect(editable(page).locator('p')).toContainText('Hello world');
});

test('the table context menu inserts a row and deletes the table', async ({ page }) => {
    await page.goto('/');
    const editor = editable(page);

    // The seeded table survives the base sanitizer.
    await expect(editor.locator('tr')).toHaveCount(2);

    await editor.locator('td').first().click({ button: 'right' });
    await page.getByRole('button', { name: 'Insert Row Below' }).click();

    await expect(editor.locator('tr')).toHaveCount(3);
    // …and the change reached the bound model, not just the DOM.
    const html = page.getByTestId('editor-html');
    await expect(html).toContainText('<table');
    expect(((await html.textContent()) ?? '').split('<tr').length - 1).toBe(3);

    await editor.locator('td').first().click({ button: 'right' });
    await page.getByRole('button', { name: 'Delete Table' }).click();

    await expect(editor.locator('table')).toHaveCount(0);
    await expect(html).not.toContainText('<table');
});

test('Control+h opens find & replace and Replace All rewrites the model', async ({ page }) => {
    await page.goto('/');
    const editor = editable(page);

    // Shortcuts dispatch from the editable's own keydown, so it must be focused.
    await editor.locator('p').click();
    await page.keyboard.press('Control+h');

    const find = page.getByPlaceholder('Search text...');
    await expect(find).toBeVisible();
    await find.fill('Hello');
    await expect(page.getByText('1/2', { exact: true })).toBeVisible();

    await page.getByPlaceholder('Replace with...').fill('Bye');
    await page.getByRole('button', { name: 'Replace All' }).click();

    const html = page.getByTestId('editor-html');
    await expect(html).not.toContainText('Hello');
    expect(((await html.textContent()) ?? '').split('Bye').length - 1).toBe(2);
});

test('find shows 0/0 and disables navigation when nothing matches', async ({ page }) => {
    await page.goto('/');
    const editor = editable(page);

    await editor.locator('p').click();
    await page.keyboard.press('Control+f');

    const find = page.getByPlaceholder('Search text...');
    await expect(find).toBeVisible();
    await find.fill('zzzznomatch');

    await expect(page.getByText('0/0', { exact: true })).toBeVisible();
    const panel = page.locator('[data-testid="editor"]').locator('..');
    await expect(panel.getByRole('button', { name: '▲' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: '▼' })).toBeDisabled();
});

test('Control+z undoes typing and Control+y redoes it', async ({ page }) => {
    await page.goto('/');
    const editor = editable(page);
    const html = page.getByTestId('editor-html');
    const before = (await html.textContent()) ?? '';

    // Undo with an empty history is a no-op.
    await editor.locator('p').click();
    await page.keyboard.press('Control+z');
    await expect(html).toHaveText(before);

    await editor.locator('p').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' appended');
    await expect(editor).toContainText('appended');
    // Let the debounced history push land, or the undo collapses into it.
    await page.waitForTimeout(HISTORY_DEBOUNCE_MS);

    await page.keyboard.press('Control+z');
    await expect(editor).not.toContainText('appended');
    await expect(html).not.toContainText('appended');

    await page.keyboard.press('Control+y');
    await expect(editor).toContainText('appended');
    await expect(html).toContainText('appended');
});

test('markdown mode renders the seeded markdown and round-trips edits', async ({ page }) => {
    await page.goto('/');
    const md = editable(page, 'editor-markdown');

    await expect(md.locator('h1')).toHaveText('Title');
    await expect(md.locator('strong')).toHaveText('bold');

    await md.locator('h1').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Extra');

    const out = page.getByTestId('editor-markdown-output');
    await expect(out).toContainText('# Title Extra');
    // The rest of the document survives the serialize/parse round trip.
    await expect(out).toContainText('**bold**');

    // An empty markdown editor renders its placeholder and emits nothing.
    await expect(page.getByTestId('editor-markdown-empty-output')).toHaveText('');
    await expect(editable(page, 'editor-markdown-empty')).toHaveAttribute(
        'placeholder',
        'Write something...',
    );
});

test('a FormControl drives the editor, and [disabled] locks it', async ({ page }) => {
    await page.goto('/');
    const form = editable(page, 'editor-form');
    const value = page.getByTestId('form-value');

    await expect(form).toContainText('form');
    await expect(value).toContainText('<p>form</p>');

    await form.locator('p').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' typed');
    await expect(value).toContainText('typed');

    // KNOWN GAP (spec correction C-15): the editor's ControlValueAccessor has
    // no setDisabledState, so `control.disable()` does NOT reach it — only the
    // [disabled] input does. This harness found that; the assertions below pin
    // today's real behaviour so the gap is visible rather than silently green.
    await page.getByTestId('toggle-form-disabled').click();
    await expect(form).toHaveAttribute('contenteditable', 'true');

    // The [disabled] input, which is the working path, does lock it: the docked
    // toolbar stays rendered (it hides only for readonly) and every button is
    // [disabled].
    await page.getByTestId('toggle-input-disabled').click();
    await expect(form).toHaveAttribute('contenteditable', 'false');
    const buttons = page.locator('[data-testid="editor-form"] [role="toolbar"] button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await expect(buttons.nth(i)).toBeDisabled();

    // Typing while disabled changes nothing.
    const locked = (await value.textContent()) ?? '';
    await form.click({ force: true });
    await page.keyboard.type(' ignored');
    await expect(value).toHaveText(locked);

    await page.getByTestId('toggle-input-disabled').click();
    await expect(form).toHaveAttribute('contenteditable', 'true');
    await expect(buttons.first()).toBeEnabled();
});

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
    await expect(page.getByText('1 of 2', { exact: true })).toBeVisible();

    await page.getByPlaceholder('Replace with...').fill('Bye');
    await page.getByRole('button', { name: 'Replace All' }).click();

    const html = page.getByTestId('editor-html');
    await expect(html).not.toContainText('Hello');
    expect(((await html.textContent()) ?? '').split('Bye').length - 1).toBe(2);
});

test('find reports No results and disables navigation when nothing matches', async ({ page }) => {
    await page.goto('/');
    const editor = editable(page);

    await editor.locator('p').click();
    await page.keyboard.press('Control+f');

    const find = page.getByPlaceholder('Search text...');
    await expect(find).toBeVisible();
    await find.fill('zzzznomatch');

    await expect(page.getByText('No results', { exact: true })).toBeVisible();
    const panel = page.locator('[data-testid="editor"]').locator('..');
    await expect(panel.getByRole('button', { name: 'Previous match' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Next match' })).toBeDisabled();
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

test('a FormControl drives the editor; control.disable() and [disabled] each lock it', async ({ page }) => {
    await page.goto('/');
    const form = editable(page, 'editor-form');
    const value = page.getByTestId('form-value');

    await expect(form).toContainText('form');
    await expect(value).toContainText('<p>form</p>');

    await form.locator('p').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' typed');
    await expect(value).toContainText('typed');

    const buttons = page.locator('[data-testid="editor-form"] [role="toolbar"] button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    // Was spec correction C-15: the CVA had no setDisabledState, so
    // control.disable() never reached the editor. Fixed — the form's state now
    // OR-s with the [disabled] input, so this locks the editable area, marks it
    // aria-disabled and disables every toolbar button.
    await page.getByTestId('toggle-form-disabled').click();
    await expect(form).toHaveAttribute('contenteditable', 'false');
    await expect(form).toHaveAttribute('aria-disabled', 'true');
    for (let i = 0; i < count; i++) await expect(buttons.nth(i)).toBeDisabled();

    // Typing while the form has disabled the control changes nothing.
    const formLocked = (await value.textContent()) ?? '';
    await form.click({ force: true });
    await page.keyboard.type(' ignored');
    await expect(value).toHaveText(formLocked);

    // control.enable() reverses it.
    await page.getByTestId('toggle-form-disabled').click();
    await expect(form).toHaveAttribute('contenteditable', 'true');
    await expect(buttons.first()).toBeEnabled();

    // The [disabled] input still works independently of the form's state.
    await page.getByTestId('toggle-input-disabled').click();
    await expect(form).toHaveAttribute('contenteditable', 'false');
    for (let i = 0; i < count; i++) await expect(buttons.nth(i)).toBeDisabled();

    const inputLocked = (await value.textContent()) ?? '';
    await form.click({ force: true });
    await page.keyboard.type(' ignored');
    await expect(value).toHaveText(inputLocked);

    // Neither path overrides the other: with both set, clearing only the form's
    // state leaves the editor locked by the input.
    await page.getByTestId('toggle-form-disabled').click();
    await expect(form).toHaveAttribute('contenteditable', 'false');
    await page.getByTestId('toggle-form-disabled').click();
    await expect(form).toHaveAttribute('contenteditable', 'false');

    await page.getByTestId('toggle-input-disabled').click();
    await expect(form).toHaveAttribute('contenteditable', 'true');
    await expect(buttons.first()).toBeEnabled();
});

// ── Markdown input rules ──────────────────────────────────────────────────
// These drive real keystrokes at a real contenteditable, which is the only
// place the browser's own behaviour shows up: it materialises the terminating
// space as `&nbsp;`, keeps typing inside a fresh <strong> unless the caret is
// parked outside it, and reports `inputType` on every event. None of that is
// reproducible in the headless leg.

/**
 * A fresh empty paragraph after the seeded one, with the caret in it.
 *
 * The seeded document ends with a `<table>`, so `Control+End` would land the
 * caret in a table cell — where block rules are correctly guarded off. Enter at
 * the end of the FIRST paragraph gives us the plain block the rules act on.
 */
const emptyParagraph = async (page: Page) => {
    const editor = editable(page);
    await editor.locator('p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    return editor;
};

test('typing "# Hello" makes a real h1 in both the DOM and the bound model', async ({ page }) => {
    await page.goto('/');
    const editor = await emptyParagraph(page);

    await page.keyboard.type('# Hello');

    await expect(editor.locator('h1')).toHaveText('Hello');
    await expect(page.getByTestId('editor-html')).toContainText('<h1');
});

test('Backspace immediately after "# " puts the literal marker back', async ({ page }) => {
    await page.goto('/');
    const editor = await emptyParagraph(page);

    await page.keyboard.type('# ');
    await expect(editor.locator('h1')).toHaveCount(1);

    await page.keyboard.press('Backspace');

    await expect(editor.locator('h1')).toHaveCount(0);
    await expect(editor).toContainText('#');
});

test('one Control+z after "# " restores the literal marker, not the blank line', async ({ page }) => {
    await page.goto('/');
    const editor = await emptyParagraph(page);

    await page.keyboard.type('# ');
    await expect(editor.locator('h1')).toHaveCount(1);

    await page.keyboard.press('Control+z');

    await expect(editor.locator('h1')).toHaveCount(0);
    await expect(editor).toContainText('#');
});

test('the block markers each build their own structure', async ({ page }) => {
    await page.goto('/');
    const editor = await emptyParagraph(page);

    await page.keyboard.type('- item');
    await expect(editor.locator('ul > li')).toContainText('item');

    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('[] task');
    const task = editor.locator('ul[data-task-list] > li[data-task]');
    await expect(task).toContainText('task');
    await expect(task.locator('input[type="checkbox"]')).toHaveCount(1);
});

test('"---" becomes a horizontal rule and "**bold**" a strong', async ({ page }) => {
    await page.goto('/');
    const editor = await emptyParagraph(page);

    await page.keyboard.type('---');
    await expect(editor.locator('hr')).toHaveCount(1);

    await page.keyboard.type('**bold**');
    await expect(editor.locator('strong')).toHaveText('bold');

    // The caret is parked outside the strong, so what follows is plain text.
    await page.keyboard.type('after');
    await expect(editor.locator('strong')).toHaveText('bold');
    await expect(page.getByTestId('editor-html')).toContainText('<strong>bold</strong>');
});

test('markdown mode reports the transformed value, not the marker', async ({ page }) => {
    await page.goto('/');
    const md = editable(page, 'editor-markdown');

    // The seeded document already opens with an h1 ("Title"), so assert on the
    // count and the LAST one — the heading the rule just built.
    await expect(md.locator('h1')).toHaveCount(1);

    await md.locator('h1').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('# Fresh');

    await expect(md.locator('h1')).toHaveCount(2);
    await expect(md.locator('h1').last()).toContainText('Fresh');
    await expect(page.getByTestId('editor-markdown-output')).toContainText('# Fresh');
});

test('the Text style select reflects the caret block and converts it back', async ({ page }) => {
    await page.goto('/');
    const editor = await emptyParagraph(page);
    const select = page.locator(
        '[data-testid="editor"] [data-slot="rich-text-toolbar-text-style"]',
    );

    await expect(select).toBeVisible();

    await page.keyboard.type('# Heading');
    await expect(editor.locator('h1')).toHaveText('Heading');
    await expect(select).toHaveValue('heading1');

    await select.selectOption('paragraph');
    await expect(editor.locator('h1')).toHaveCount(0);
    await expect(editor).toContainText('Heading');
});

test('T-30 find highlights never reach the model, and Replace All is one undo step', async ({ page }) => {
    await page.goto('/');
    const editor = editable(page);
    const html = page.getByTestId('editor-html');
    const before = (await html.textContent()) ?? '';

    // Open with the replace row from the start: the shortcuts fire from the
    // editable's own keydown, so pressing Control+h once focus is in the find
    // input would never reach the editor.
    await editor.locator('p').first().click();
    await page.keyboard.press('Control+h');

    const find = page.getByPlaceholder('Search text...');
    await find.fill('Hello');
    await expect(page.getByText('1 of 2', { exact: true })).toBeVisible();

    // The highlights are an overlay, not content: painted rectangles exist,
    // but no <mark> is in the editable and the bound model is untouched.
    await expect(page.locator('[data-slot="rich-text-find-overlay"] [data-find-rect]').first()).toBeVisible();
    await expect(editor.locator('mark')).toHaveCount(0);
    await expect(html).toHaveText(before);

    await page.getByPlaceholder('Replace with...').fill('Bye');
    await page.getByRole('button', { name: 'Replace All' }).click();
    await expect(html).not.toContainText('Hello');

    // One undo takes the whole sweep back. The seeded document reaches the
    // editor through ngModel, i.e. writeValue, which records nothing by design
    // (UC-28) — so what undo restores is the entry Replace All pushed over,
    // and the assertion that matters is that no <mark> ever entered the model.
    await editor.locator('p').first().click();
    await page.keyboard.press('Control+z');

    expect((await html.textContent()) ?? '').not.toContain('<mark');
    await expect(editor.locator('mark')).toHaveCount(0);
});

test('T-44 setContent and an overlay insert are each their own undo step', async ({ page }) => {
    await page.goto('/');
    const editor = editable(page);
    const html = page.getByTestId('editor-html');

    // Type first, so there is a recorded state for setContent's undo to land
    // on: the seeded document arrives via writeValue, which records nothing.
    await editor.locator('p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' typed');
    await page.waitForTimeout(HISTORY_DEBOUNCE_MS);

    // A programmatic edit is recorded, so undo returns the previous document.
    await page.getByTestId('load-draft').click();
    await expect(editor).toContainText('Draft loaded.');

    await editor.locator('p').first().click();
    await page.keyboard.press('Control+z');

    // Exactly one step back: the typed text returns AND the draft is gone.
    // Asserting only the former would also pass if undo over-shot.
    await expect(editor).toContainText('typed');
    await expect(editor).not.toContainText('Draft loaded.');
    await expect(editor).toContainText('Hello world');

    // An overlay insert after a flushed typing burst is its own entry: one
    // undo takes back the insert and leaves the typing.
    await editor.locator('p').first().click();
    await page.keyboard.press('End');
    await page.waitForTimeout(HISTORY_DEBOUNCE_MS);

    await page.getByTestId('insert-star').click();
    await expect(editor).toContainText('★');

    await editor.locator('p').first().click();
    await page.keyboard.press('Control+z');

    // Again exactly one step: the star goes, the typing stays.
    await expect(editor).not.toContainText('★');
    await expect(editor).toContainText('typed');
    await expect(html).toContainText('typed');
});

// T-44 — the public imperative API from a page button, in a pristine install.
// The button steals focus from the editor before its handler runs, so this is
// the exact scenario `insertText`/`format` exist to make work.
test('a page button calling editor.insertText inserts at the caret and one undo removes only it', async ({ page }) => {
    await page.goto('/');
    const editor = editable(page);
    const html = page.getByTestId('editor-html');

    await editor.locator('p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' typed');
    await page.waitForTimeout(HISTORY_DEBOUNCE_MS);

    await page.getByTestId('insert-text').click();

    await expect(editor).toContainText('typed signed');
    await expect(html).toContainText('signed');

    await editor.locator('p').first().click();
    await page.keyboard.press('Control+z');

    await expect(editor).not.toContainText('signed');
    await expect(editor).toContainText('typed');
});

test('a page button calling editor.format("bold") bolds the selection', async ({ page }) => {
    await page.goto('/');
    const editor = editable(page);

    // Select the first word with the keyboard rather than a dblclick: a
    // dblclick in this harness lands a collapsed caret (probed: rangeCount 1,
    // selected text ""), so the test would assert that `format` bolds an empty
    // selection — which is exactly what it does.
    await editor.locator('p').first().click();
    await page.keyboard.press('Home');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');

    const selected = await page.evaluate(() => document.getSelection()?.toString() ?? '');
    expect(selected).toBe('Hello');
    await expect(editor.locator('b, strong')).toHaveCount(0);

    await page.getByTestId('format-bold').click();

    await expect(editor.locator('b, strong').first()).toBeVisible();
    await expect(page.getByTestId('editor-html')).toContainText(/<(b|strong)>/);
});

import { test, expect } from '@playwright/test';

// Proves the rich-text AI addon end-to-end in a real consumer install: the
// editor base + the separately-installed `ai` addon snap together through
// Angular DI (the selection chip + task panel + `/ai` command, all driven by
// the addon over the editor host). That the harness compiles at all proves the
// addon builds under AOT in a plain consumer app (no workspace dedup) with its
// own `ai.ts` lib file, and that the base ships no AI UI.

test('the base editor ships no AI chip until a selection with the addon', async ({ page }) => {
    await page.goto('/');

    // The editor without the directive never shows an AI chip.
    const plain = page.locator('[data-testid="editor-plain"]');
    const editable = plain.locator('[data-slot="rich-text-editor"]');
    await editable.click();
    await expect(page.locator('[data-testid="editor-plain"] [data-slot="rich-text-ai-trigger"]')).toHaveCount(0);
});

test('selecting text reveals the chip; running a task and accepting inserts the result', async ({ page }) => {
    await page.goto('/');

    const editor = page.locator('[data-testid="editor"]');
    const editable = editor.locator('[data-slot="rich-text-editor"]');

    // Select the paragraph so the AI task has a target.
    await editable.locator('p').click({ clickCount: 3 });

    // The chip appears on the active selection (addon-only UI).
    const chip = page.locator('[data-slot="rich-text-ai-trigger"]');
    await expect(chip).toBeVisible();
    await chip.click();

    // The task panel opens; pick the first built-in task ("Improve writing").
    const panel = page.locator('[data-slot="rich-text-ai-panel"]');
    await expect(panel).toBeVisible();
    await panel.locator('[data-slot="rich-text-ai-menu"] > button').first().click();

    // The mock provider resolves; Accept keeps the generated draft.
    await panel.getByRole('button', { name: 'Accept' }).click();

    await expect(editable).toContainText('AI[Select this sentence and ask AI.]');
    await expect(page.locator('[data-testid="last-result"]')).toContainText('AI[');
});

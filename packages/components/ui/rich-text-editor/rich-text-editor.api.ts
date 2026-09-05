import type { Signal } from '@angular/core';
import type { RichTextSelectionSnapshot } from './rich-text-editor.host';
import type { RichTextSetContentOptions } from './rich-text-editor.component';
import type { ToolbarButtonItem } from './sub/rich-text-toolbar.component';

/**
 * Toolbar commands a consumer may run through {@link RichTextEditorApi.format}.
 *
 * Narrower than `ToolbarButtonItem` on purpose: `'textStyle'` is a select
 * rather than a command, `'find'` opens a panel, and `'undo'` / `'redo'` have
 * their own methods on this interface. Passing any of them is a compile error,
 * which is the whole point of the type — there is no runtime allow-list.
 */
export type RichTextFormatCommand = Exclude<
    ToolbarButtonItem,
    'textStyle' | 'find' | 'undo' | 'redo'
>;

/**
 * The consumer-facing surface of `<ui-rich-text-editor>` — what application
 * code may call on a `viewChild`. Everything else public on the component is
 * either the addon-host contract (`RichTextEditorAddonHost`) or template
 * plumbing, and is not covered by this contract.
 *
 * `RichTextEditorComponent` implements it, so a `viewChild.required(
 * RichTextEditorComponent)` satisfies it without a cast, and a helper that
 * only needs the API can take `RichTextEditorApi` and never import the
 * component class.
 *
 * @example
 * ```ts
 * function insertSignature(editor: RichTextEditorApi, name: string): void {
 *   editor.focus();
 *   editor.insertHtml(`<p>— <em>${name}</em></p>`);
 * }
 * ```
 */
export interface RichTextEditorApi {
    /**
     * Focus the editable and restore the caret the user last had inside it —
     * the caret saved on blur, the live in-editor selection, or the end of the
     * content when there is neither. No-op while the editor is disabled.
     */
    focus(): void;
    /**
     * Insert plain text at the restored caret as one history entry, then focus
     * the editor. No-op while readonly or disabled, and for the empty string.
     */
    insertText(text: string): void;
    /**
     * Insert HTML at the restored caret as one history entry, then focus the
     * editor. The markup goes through the editor's allow-list sanitizer, so a
     * `<script>` is dropped rather than inserted. No-op while readonly or
     * disabled, and when nothing survives sanitization.
     */
    insertHtml(html: string): void;
    /**
     * Run a toolbar command exactly as a toolbar click would: the selection is
     * restored first, the command records one history entry, `activeFormats()`
     * is re-detected and the editor is refocused.
     */
    format(command: RichTextFormatCommand): void;
    /** Snapshot of the current selection / caret target (shared with the addon host). */
    selection(): RichTextSelectionSnapshot;
    /**
     * `true` when the document has no visible text and no image, rule or table
     * — the same rule `richTextRequired()` applies, so a form's validity and a
     * "Send" button's disabled state can never disagree.
     *
     * Parses the document on each call. Bind it through a `computed` over
     * `htmlOutput()` rather than calling it directly in a template.
     */
    isEmpty(): boolean;
    /**
     * Undo one step — mirrors `Ctrl`/`Cmd`+`Z`. Flushes a pending typing burst
     * first, so one call takes back the whole burst. No-op at the start of the
     * stack.
     */
    undo(): void;
    /**
     * Redo one step — mirrors `Ctrl`+`Y` / `Ctrl`+`Shift`+`Z`. No-op at the end
     * of the stack.
     */
    redo(): void;
    /**
     * Replace the content from application code. Mode-aware like `writeValue`,
     * calls the form's `onChange`, and records one history entry by default.
     */
    setContent(value: string, options?: RichTextSetContentOptions): void;
    /** Treat the current content as saved, so {@link isDirty} reads false again. */
    markClean(): void;
    /** Whether an undo step is available. */
    readonly canUndo: Signal<boolean>;
    /** Whether a redo step is available. */
    readonly canRedo: Signal<boolean>;
    /** Whether the content changed since the last form write or {@link markClean}. */
    readonly isDirty: Signal<boolean>;
    /** The content as sanitized HTML, whatever the editor's `mode`. */
    readonly htmlOutput: Signal<string>;
    /** The content as markdown, whatever the editor's `mode`. */
    readonly markdownOutput: Signal<string>;
}

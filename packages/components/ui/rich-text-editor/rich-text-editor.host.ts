import type { Injector, Signal, Type } from '@angular/core';
import { AddonSlotRegistry } from '../../lib/addon-slots';
import type { RichTextCommandRegistry, RichTextSlashCommand } from './rich-text-command-registry.service';

export { AddonSlotRegistry } from '../../lib/addon-slots';

/**
 * An addon-contributed toolbar item, rendered by the base after built-ins.
 *
 * Two shapes:
 * - **Button slot** — provide `icon` + `tooltip` + `onClick` and the base
 *   renders a standard toolbar button.
 * - **Component slot** — provide `component` and the base renders it in place
 *   of a button via component outlet; the component owns its own trigger UI
 *   and can `inject(RichTextEditorAddonHost)` for editor access. When
 *   `component` is set the button fields are ignored.
 */
export interface RichTextToolbarSlot {
    /** Stable id (also the `data-addon-slot` value). */
    readonly id: string;
    /** Inline SVG markup for the button glyph (button slots). */
    readonly icon?: string;
    readonly tooltip?: string;
    /** Sort order among slots; lower first. Default appends. */
    readonly order?: number;
    /** Return false to disable the button. Polled through signal reads. */
    readonly isEnabled?: () => boolean;
    /** Return true to render the button in its active state. */
    readonly isActive?: () => boolean;
    readonly onClick?: (event: Event) => void;
    /** Component rendered instead of a button; wins over the button fields. */
    readonly component?: Type<unknown>;
    /** Optional injector for `component` (defaults to the toolbar's view injector). */
    readonly injector?: Injector;
}

/**
 * View context the toolbar provides to component slots. Injectable from a
 * slot component (`inject(RichTextToolbarViewContext, { optional: true })`)
 * so the slot can match the hosting toolbar's rendering mode — e.g. use the
 * compact button sizing inside the floating/bubble toolbar.
 */
export abstract class RichTextToolbarViewContext {
    /** Whether the hosting toolbar renders in compact (floating) mode. */
    abstract readonly compact: Signal<boolean>;
}

/**
 * A read-only projection of one revision-history entry, exposed to the history
 * addon. Deliberately narrower than the editor's internal entry: the delta,
 * keyframe and serialized-selection fields stay private to the base.
 */
export interface RichTextHistoryEntrySnapshot {
    /** Zero-based position of the entry in the history stack. */
    readonly index: number;
    /** Capture time, epoch milliseconds. */
    readonly timestamp: number;
    /** Single-line plain-text preview (truncated). */
    readonly preview: string;
    /** First few lines of the entry's plain text. */
    readonly previewLines: readonly string[];
    /** Total plain-text line count for this entry. */
    readonly lineCount: number;
}

/** A read-only snapshot of the editor's current selection / caret target. */
export interface RichTextSelectionSnapshot {
    readonly kind: 'text' | 'image' | 'none';
    /** Selected text, or '' for image / none. */
    readonly text: string;
    /** A clone of the selection range, or null. */
    readonly range: Range | null;
    /** The selected/focused image, or null. */
    readonly imageElement: HTMLImageElement | null;
    /** Nearest ancestor element carrying any of the given attributes, if the caret sits inside one. */
    closestWithAttrs(attrs: readonly string[]): HTMLElement | null;
}

/**
 * The stable extension surface a rich-text-editor addon reaches through DI
 * (`inject(RichTextEditorAddonHost)`). `RichTextEditorComponent` provides
 * itself as this token; the base never imports any addon. This is the one
 * boundary that lets the base's internals change without breaking addons.
 */
export abstract class RichTextEditorAddonHost {
    /** Toolbar slot registry the base renders after built-in items. */
    abstract readonly toolbarSlots: AddonSlotRegistry<RichTextToolbarSlot>;
    /** The editor's slash-command registry. */
    abstract readonly commands: RichTextCommandRegistry;
    /** Reactive-friendly snapshot of the current selection / caret target. */
    abstract selection(): RichTextSelectionSnapshot;
    /** Persist the current DOM selection so it survives a dialog interaction. */
    abstract saveSelection(): void;
    /** Restore a previously saved (or current in-editor) selection. */
    abstract restoreSelection(): void;
    /**
     * Run a mutation against the content root inside the editor transaction:
     * one history entry, re-sanitize, and emit change events.
     */
    abstract mutateContent(mutate: (root: HTMLElement) => void): void;
    /** Wrap the saved text selection in the built element; returns created elements. */
    abstract wrapSelection(build: () => HTMLElement): HTMLElement[];
    /**
     * Insert plain text at the (saved) caret position from an overlay UI
     * (picker, menu): restores the in-editor selection, inserts as one
     * history entry, re-saves the caret, and guards against the mobile
     * keyboard flashing while focus returns from the overlay.
     */
    abstract insertTextFromOverlay(text: string): void;
    /** Whether the editor is disabled. */
    abstract readonly disabled: Signal<boolean>;
    /** Whether the editor is read-only. */
    abstract readonly readonly: Signal<boolean>;
    /** The contenteditable content root (for popover anchoring + scoped styles). */
    abstract readonly contentRoot: HTMLElement;

    // ── Slash-command / block seam ────────────────────────────────────

    /**
     * Register a keydown interceptor, invoked before the base handles the
     * event. Return `true` to consume the event (the interceptor does its own
     * `preventDefault`) and stop base handling. Returns a teardown.
     */
    abstract registerKeydownInterceptor(interceptor: (event: KeyboardEvent) => boolean): () => void;
    /**
     * Register an observer of the editor's trigger-aware text and caret offset,
     * invoked on every input with the same values the base computes for its own
     * trigger detection. Returns a teardown.
     */
    abstract registerInputObserver(observer: (text: string, caretOffset: number) => void): () => void;
    /**
     * Apply a built-in toolbar command to a specific block (its block-transform
     * engine): re-tag/list-wrap the block or run the formatting command, place
     * the caret, and record one history entry.
     */
    abstract executeToolbarCommandOnBlock(command: string, anchorBlock: HTMLElement | null): void;
    /**
     * Commit direct DOM edits an addon made to the content root: re-read the
     * model from the DOM (emit change events) and flush any pending debounced
     * history push as one entry. Call after mutating the DOM outside the other
     * host methods (e.g. consuming a trigger) so the model can't drift.
     */
    abstract commitContent(): void;
    /** Insert plain text at the live caret as one history entry. */
    abstract insertTextAtCaret(text: string): void;
    /** Insert sanitized HTML at the live caret as one history entry. */
    abstract insertHtmlAtCaret(html: string): void;
    /**
     * Open the editor's link popover. `caretHint` positions the popover when the
     * live caret rect is degenerate (e.g. an empty block).
     */
    abstract showLinkDialog(caretHint?: { x: number; y: number }): void;
    /**
     * Base-owned slash commands wired to features that stay in the base: the
     * document-outline command, plus the AI command when an `aiProvider` is set.
     */
    abstract readonly builtinCommands: Signal<readonly RichTextSlashCommand[]>;

    // ── Revision-history seam ─────────────────────────────────────────

    /**
     * Bumps on every change to the history stack (push, undo, redo, restore).
     * The history addon reads it to recompute its timeline projections.
     */
    abstract readonly historyVersion: Signal<number>;
    /** Read-only projection of the current history stack, oldest first. */
    abstract historyEntries(): readonly RichTextHistoryEntrySnapshot[];
    /** Index of the entry the editor currently reflects. */
    abstract currentHistoryIndex(): number;
    /**
     * Reconstruct the HTML + Markdown of the history entry at `index`, using the
     * base's cached reconstruction. Returns `null` for an out-of-range index.
     */
    abstract reconstructHistoryEntry(index: number): { html: string; markdown: string } | null;
    /** Flush any pending debounced history push so the timeline is up to date. */
    abstract flushPendingHistoryPush(): void;
    /**
     * Jump the editor to the history entry at `index`: reconstruct and apply its
     * content, restore its selection, and emit a change — WITHOUT pushing a new
     * entry, so the forward entries stay available for redo.
     */
    abstract restoreHistoryEntry(index: number): void;
    /**
     * The editor's positioned (relative) container element. An overlay addon
     * appends its own host element here so it can be `absolute`-positioned
     * against the editor frame (e.g. the history corner button).
     */
    abstract readonly overlayAnchor: HTMLElement;
    /**
     * Bind an action to one of the editor's known keyboard-shortcut definitions
     * (see `RICH_TEXT_SHORTCUT_DEFINITIONS`). The base keeps the definition but
     * ships no handler; an addon supplies the `run` callback (guarded by the
     * optional `when`, and always by the editor's editable state). Returns a
     * teardown; the shortcut is inert while no action is registered.
     */
    abstract registerShortcutAction(actionId: string, run: () => void, when?: () => boolean): () => void;
}

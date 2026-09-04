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

/**
 * An inline text style an addon applies to the current/saved selection. Each
 * field is optional so a caller can set just the property it owns (the colors
 * addon sends `color` or `backgroundColor`; typography sends `fontSize` or
 * `fontFamily`).
 */
export interface RichTextInlineStyle {
    /** CSS color, e.g. `#ff0000` — applied via `foreColor`. */
    readonly color?: string;
    /** CSS background color — applied via `hiliteColor`/`backColor`. */
    readonly backgroundColor?: string;
    /** CSS font size, e.g. `18px`. */
    readonly fontSize?: string;
    /** CSS font family, e.g. `Georgia`. */
    readonly fontFamily?: string;
}

/**
 * The inline style computed from the caret/current selection, as raw browser
 * values (`rgb(...)`, `18px`, the first family). Addons normalize these as
 * needed — e.g. the colors addon hex-normalizes `color`/`backgroundColor`.
 */
export interface RichTextSelectionInlineStyle {
    readonly color: string;
    readonly backgroundColor: string;
    readonly fontSize: string;
    readonly fontFamily: string;
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
    /**
     * THIS editor instance's slash-command registry. Addons register here, so
     * a command appears only in the editor whose element carries the addon
     * directive.
     */
    abstract readonly commands: RichTextCommandRegistry;
    /**
     * The app-wide (root) slash-command registry. Consumers can inject the
     * root `RichTextCommandRegistry` once and register commands that appear
     * in EVERY editor's menu; instance commands win on id collisions.
     * Edge case: an editor nested inside another editor's projected content
     * resolves the OUTER editor's instance as its "global" registry
     * (skipSelf finds the nearest ancestor provider, not necessarily root).
     */
    abstract readonly globalCommands: RichTextCommandRegistry;
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
    /**
     * The editor's `[disabled]` input alone. Addons guarding an interaction want
     * {@link isDisabled}, which also accounts for a reactive form having
     * disabled the control.
     */
    abstract readonly disabled: Signal<boolean>;
    /**
     * Whether the editor is effectively disabled — the `[disabled]` input OR a
     * reactive form's own disabled state (`control.disable()`). Every addon
     * interaction guard reads this.
     */
    abstract readonly isDisabled: Signal<boolean>;
    /** Whether the editor is read-only. */
    abstract readonly readonly: Signal<boolean>;
    /** The contenteditable content root (for popover anchoring + scoped styles). */
    abstract readonly contentRoot: HTMLElement;


    /**
     * Apply an inline text style to the current (or last-saved) selection: for
     * each property present, restore the right selection, run the matching
     * `execCommand` path (foreColor / hiliteColor for colours, fontSize /
     * fontName for typography), style any mention chips the command skips, and
     * emit change events — recording one history entry per applied property.
     * Callers set a single property per call, so this is normally one entry.
     * The colour paths are a no-op when there is no selection/caret to target.
     */
    abstract applyInlineStyle(style: RichTextInlineStyle): void;
    /**
     * The inline style at the caret/current selection, as raw browser values.
     * Recomputes as the selection moves; addons normalize the values they use.
     */
    abstract readonly selectionInlineStyle: Signal<RichTextSelectionInlineStyle>;


    /**
     * Register a keydown interceptor, invoked before the base handles the
     * event. Return `true` to consume the event (the interceptor does its own
     * `preventDefault`) and stop base handling. Returns a teardown.
     */
    abstract registerKeydownInterceptor(interceptor: (event: KeyboardEvent) => boolean): () => void;
    /**
     * Register a paste interceptor, invoked after the base's own
     * `preventDefault` but before the base normalizes/inserts the clipboard.
     * Return `true` to consume the paste (the interceptor handles insertion)
     * and stop base handling. Used by the images addon to divert pasted image
     * files into the upload/insert pipeline. Returns a teardown.
     */
    abstract registerPasteInterceptor(interceptor: (event: ClipboardEvent) => boolean): () => void;
    /**
     * Register a drop interceptor, invoked before the base handles a file drop.
     * Return `true` to consume the drop (the interceptor does its own
     * `preventDefault` and insertion) and stop base handling. Used by the images
     * addon to accept dropped image files. Returns a teardown.
     */
    abstract registerDropInterceptor(interceptor: (event: DragEvent) => boolean): () => void;
    /**
     * Register a predicate that decides whether a dragged payload is acceptable,
     * so the base shows its drop-zone highlight and calls `preventDefault` for
     * an otherwise-ignored drag. Return `true` to claim the drag. The base ORs
     * these with its own (document-import) acceptance. Returns a teardown.
     */
    abstract registerDropZonePredicate(predicate: (event: DragEvent) => boolean): () => void;


    /**
     * Register the addon that owns image files — the images addon, whose
     * pipeline resolves the configured uploader vs a `data:` URL, applies the
     * default width/height/alignment, and emits the image upload outputs.
     * Only one addon owns images at a time; registering replaces the previous
     * handler. Returns a teardown that only clears it if still the current one.
     */
    abstract registerImageFileHandler(handler: (file: File) => void): () => void;
    /**
     * Whether an addon currently owns image files. Other addons gate their
     * image affordances on this so they never offer an image path the editor
     * cannot route (e.g. the file-import picker hides image types).
     */
    abstract readonly hasImageFileHandler: Signal<boolean>;
    /**
     * Route an image file through the owning addon, so an image inserted from
     * anywhere (paste, drop, the images toolbar, the file-import picker) takes
     * one and the same path. Returns `false` when no addon owns images, in
     * which case nothing was inserted and the caller must handle it.
     */
    abstract insertImageFile(file: File): boolean;
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
     * Open the link editor. A delegation seam: the base keeps this method (so the
     * `Ctrl/Cmd+K` shortcut and the `/link` slash command have a stable entry
     * point) but ships no link UI — it forwards to the editor registered via
     * {@link registerLinkEditor}, and is a no-op when no links addon is present.
     * `caretHint` positions the editor when the live caret rect is degenerate
     * (e.g. an empty block).
     */
    abstract showLinkDialog(caretHint?: { x: number; y: number }): void;
    /**
     * Register the link editor the base's {@link showLinkDialog} delegates to.
     * The links addon supplies the `open` callback; the base keeps the
     * `rich-text.link` shortcut definition and the `/link` command entry point
     * but stays link-UI-free. Returns a teardown; `showLinkDialog` is inert while
     * no editor is registered.
     */
    abstract registerLinkEditor(open: (caretHint?: { x: number; y: number }) => void): () => void;
    /**
     * Base-owned slash commands the slash-commands addon merges into its menu.
     * Currently empty — every feature command (`/outline`, `/ai`, `/link`, …) is
     * registered by its own opt-in addon into {@link commands}. The seam is kept
     * so the base can reclaim a built-in command later without a contract change.
     */
    abstract readonly builtinCommands: Signal<readonly RichTextSlashCommand[]>;


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

import type { Injector, Signal, Type } from '@angular/core';
import { AddonSlotRegistry } from '../../lib/addon-slots';
import type { RichTextCommandRegistry } from './rich-text-command-registry.service';

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
}

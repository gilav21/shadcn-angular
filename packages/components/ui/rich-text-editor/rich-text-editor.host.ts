import type { Signal } from '@angular/core';
import { AddonSlotRegistry } from '../../lib/addon-slots';
import type { RichTextCommandRegistry } from './rich-text-command-registry.service';

export { AddonSlotRegistry } from '../../lib/addon-slots';

/** An addon-contributed toolbar button, rendered by the base after built-ins. */
export interface RichTextToolbarSlot {
    /** Stable id (also the `data-addon-slot` value). */
    readonly id: string;
    /** Inline SVG markup for the button glyph. */
    readonly icon: string;
    readonly tooltip: string;
    /** Sort order among slots; lower first. Default appends. */
    readonly order?: number;
    /** Return false to disable the button. Polled through signal reads. */
    readonly isEnabled?: () => boolean;
    /** Return true to render the button in its active state. */
    readonly isActive?: () => boolean;
    readonly onClick: (event: Event) => void;
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
    /** Whether the editor is disabled. */
    abstract readonly disabled: Signal<boolean>;
    /** Whether the editor is read-only. */
    abstract readonly readonly: Signal<boolean>;
    /** The contenteditable content root (for popover anchoring + scoped styles). */
    abstract readonly contentRoot: HTMLElement;
}

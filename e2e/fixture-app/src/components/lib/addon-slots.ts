import { signal, type Signal } from '@angular/core';

/**
 * A generic, addon-agnostic registry of slot contributions. Registration is
 * reactive (host templates re-render when a slot is added/removed) and returns
 * a teardown function, mirroring the `RichTextCommandRegistry` pattern. Shared
 * by every addon host (data-table, rich-text-editor).
 */
export class AddonSlotRegistry<S> {
    private readonly _slots = signal<readonly S[]>([]);
    /** Reactive view of the registered slots, read by a host template. */
    readonly slots: Signal<readonly S[]> = this._slots.asReadonly();

    /** Register a slot; returns a teardown that removes exactly this slot. */
    register(slot: S): () => void {
        this._slots.update((list) => [...list, slot]);
        return () => this._slots.update((list) => list.filter((s) => s !== slot));
    }
}

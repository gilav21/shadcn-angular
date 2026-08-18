import {
    Component,
    ChangeDetectionStrategy,
    input,
    output,
    computed,
    signal,
    effect,
} from '@angular/core';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-collapsible',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-state]': 'open() ? "open" : "closed"',
        '[attr.data-slot]': '"collapsible"',
    },
})
export class CollapsibleComponent {
    /**
     * Blocks opening: {@link toggle} and {@link show} become no-ops and emit nothing.
     * {@link hide} is deliberately not gated, so a collapsible disabled while open can still
     * be closed programmatically. Does not dim or `aria-disable` the projected trigger —
     * style that yourself.
     */
    disabled = input(false);
    /**
     * Opens the collapsible on first render. One-way and latching: it can only ever open,
     * never close, so flipping it back to `false` leaves the panel open, and toggling it
     * `true` again after the user closed it re-opens. For controlled use drive
     * {@link show} / {@link hide} instead.
     */
    defaultOpen = input(false);
    /** Extra classes for the host element. It has no base styling of its own, so this is the only source of layout for the wrapper. */
    class = input('');
    /**
     * Emits the new open state after {@link toggle}, {@link show} or {@link hide} changes it.
     * Not emitted for the initial {@link defaultOpen} expansion, and `show`/`hide` emit even
     * when the state did not actually change.
     */
    openChange = output<boolean>();

    open = signal(false);

    constructor() {
        effect(() => {
            if (this.defaultOpen()) {
                this.open.set(true);
            }
        }, { allowSignalWrites: true });
    }

    classes = computed(() =>
        cn(this.class())
    );

    /**
     * Flips the open state and emits {@link openChange}. What the projected
     * `<ui-collapsible-trigger>` calls on click, Enter and Space. Ignored while
     * {@link disabled} — including the closing direction, unlike {@link hide}.
     */
    toggle(): void {
        if (!this.disabled()) {
            const newState = !this.open();
            this.open.set(newState);
            this.openChange.emit(newState);
        }
    }

    /**
     * Opens the panel and emits `true`, even if it was already open. No-op while
     * {@link disabled}. Counterpart to {@link hide}.
     */
    show(): void {
        if (!this.disabled()) {
            this.open.set(true);
            this.openChange.emit(true);
        }
    }

    /**
     * Closes the panel and emits `false`, even if it was already closed. Unlike {@link show}
     * and {@link toggle} this works while {@link disabled}, so a collapsible can always be
     * forced shut.
     */
    hide(): void {
        this.open.set(false);
        this.openChange.emit(false);
    }
}

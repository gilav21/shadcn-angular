import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { CONTEXT_MENU } from '../context-menu.component';

@Component({
    selector: 'ui-context-menu-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-content />
        @if (shortcut()) {
            <span class="ms-auto text-xs tracking-widest text-muted-foreground">{{ shortcut() }}</span>
        }
    `,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"context-menu-item"',
        '[attr.data-inset]': 'inset()',
        '[attr.data-variant]': 'variant()',
        '(click)': 'onClick()',
    },
})
export class ContextMenuItemComponent {
    private readonly contextMenu = inject(CONTEXT_MENU, { optional: true });

    /** Extra classes merged after the defaults on the host element (the item is its own host, there is no inner wrapper). */
    class = input('');
    /** Adds `ps-8` start padding so a label-less item lines up with siblings that carry a leading icon; also reflected as `data-inset` for styling. */
    inset = input(false);
    /** `'destructive'` paints the label and its focus/hover background in the destructive palette; reflected as `data-variant` for custom styling. */
    variant = input<'default' | 'destructive'>('default');
    /**
     * Greys the item to 50% and sets `pointer-events: none`, so neither hover
     * nor a click reaches it and {@link onClick} never runs. Note it emits no
     * `aria-disabled`/`data-disabled` attribute and the item carries no
     * `role="menuitem"`, so a disabled item is invisible to assistive tech —
     * and no item participates in the sub-menu arrow-key ring, which only
     * walks `[role="menuitem"]:not([data-disabled])`.
     */
    disabled = input(false);
    /** Accelerator hint rendered end-aligned in muted small caps (e.g. `'⌘C'`). Display only — it binds no key handler; wire the shortcut yourself. */
    shortcut = input('');

    classes = computed(() => cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
        'focus:bg-accent focus:text-accent-foreground',
        'hover:bg-accent hover:text-accent-foreground',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        this.inset() && 'ps-8',
        this.variant() === 'destructive' && 'text-destructive focus:bg-destructive/10 focus:text-destructive',
        this.disabled() && 'pointer-events-none opacity-50',
        this.class()
    ));

    /**
     * Host click handler: dismisses the enclosing menu unless
     * {@link disabled}. It does not emit anything — bind your own `(click)` on
     * the element for the action; yours runs first, then the menu closes.
     */
    onClick(): void {
        if (!this.disabled()) {
            this.contextMenu?.close();
        }
    }
}

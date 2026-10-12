import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
    ElementRef,
    DestroyRef,
} from '@angular/core';
import { activateAsClick, blockDisabledActivation } from '../../../lib/menu-activation';
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
        '[attr.data-disabled]': 'disabled() || null',
        '[attr.aria-disabled]': 'disabled() || null',
        '[attr.role]': '"menuitem"',
        '[attr.tabindex]': '"-1"',
        '(click)': 'onClick()',
        '(keydown.enter)': 'activate($event)',
        '(keydown.space)': 'activate($event)',
    },
})
export class ContextMenuItemComponent {
    private readonly contextMenu = inject(CONTEXT_MENU, { optional: true });
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

    /** Extra classes merged after the defaults on the host element (the item is its own host, there is no inner wrapper). */
    class = input('');
    /** Adds `ps-8` start padding so a label-less item lines up with siblings that carry a leading icon; also reflected as `data-inset` for styling. */
    inset = input(false);
    /** `'destructive'` paints the label and its focus/hover background in the destructive palette; reflected as `data-variant` for custom styling. */
    variant = input<'default' | 'destructive'>('default');
    /**
     * Greys the item to 50% and sets `pointer-events: none`. It is exposed as
     * `aria-disabled="true"` and `data-disabled`, drops out of the menu's
     * arrow-key ring, and no activation reaches it by any route: a click from
     * assistive technology or a programmatic `.click()` is stopped before your
     * own `(click)` sees it, and Enter and Space do nothing.
     */
    disabled = input(false);
    /** Accelerator hint rendered end-aligned in muted small caps (e.g. `'⌘C'`). Display only — it binds no key handler; wire the shortcut yourself. */
    shortcut = input('');

    constructor() {
        const unblock = blockDisabledActivation(this.host, () => this.disabled());
        inject(DestroyRef).onDestroy(unblock);
    }

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
     * the element for the action; yours and the close run from the same click,
     * whether it came from the pointer, from Enter or Space, or from assistive
     * technology.
     */
    onClick(): void {
        if (!this.disabled()) {
            this.contextMenu?.close();
        }
    }

    /** Enter or Space on the item: one click, and the page behind the menu does not scroll. Nothing happens while {@link disabled}. */
    activate(event: Event): void {
        activateAsClick(event, this.host, this.disabled());
    }
}

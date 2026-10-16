import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    inject,
    input,
} from '@angular/core';
import { activateAsClick, blockDisabledActivation } from '../../../lib/menu-activation';
import { cn } from '../../../lib/utils';
import { DROPDOWN_MENU } from '../dropdown-menu.component';

@Component({
    selector: 'ui-dropdown-menu-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-content />
        @if (shortcut()) {
            <span class="ms-auto text-xs tracking-widest text-muted-foreground">{{ shortcut() }}</span>
        }
    `,
    styleUrl: './dropdown-menu-item.component.css',
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"dropdown-item"',
        '[attr.data-disabled]': 'disabled() || null',
        '[attr.aria-disabled]': 'disabled() || null',
        '[attr.role]': '"menuitem"',
        '[attr.tabindex]': '"-1"',
        '(click)': 'onClick()',
        '(keydown.enter)': 'activate($event)',
        '(keydown.space)': 'activate($event)',
    },
})
export class DropdownMenuItemComponent {
    /** Extra classes merged onto the host row, after the defaults so they can override them. */
    class = input('');
    /**
     * Dims the row, blocks pointer events, and removes it from the menu's
     * arrow-key ring (it sets `data-disabled`, which the content's item query
     * excludes). Accepts bare attribute presence.
     */
    disabled = input(false, { transform: booleanAttribute });
    /**
     * Hint text rendered right-aligned after the content (e.g. `⌘K`). Purely
     * decorative — it does not register a key binding.
     */
    shortcut = input('');

    private readonly menu = inject(DROPDOWN_MENU, { optional: true });
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

    constructor() {
        const unblock = blockDisabledActivation(this.host, () => this.disabled());
        inject(DestroyRef).onDestroy(unblock);
    }

    classes = computed(() =>
        cn(
            'relative flex cursor-pointer select-none items-center rounded-sm text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground',
            this.disabled() && 'pointer-events-none opacity-50',
            this.inset() && 'ltr:pl-8 rtl:pr-8',
            this.class()
        )
    );

    /**
     * Adds leading indentation so the label aligns with items that carry an
     * icon or checkmark. Use it on the icon-less items of a mixed menu.
     */
    inset = input(false, { transform: booleanAttribute });

    /**
     * Closes the menu on activation (click, Enter or Space). It does not invoke
     * anything itself — bind your own `(click)` for the action. Enter and Space
     * dispatch a real click on the item, so that handler runs for the keyboard
     * exactly as for a pointer, once; a {@link disabled} item stops the click
     * before any listener sees it, whichever way it was made.
     */
    onClick(): void {
        if (!this.disabled()) {
            this.menu?.hide();
        }
    }

    /**
     * Enter or Space on the item: one click, the page behind the menu does not
     * scroll. Nothing happens while {@link disabled}.
     */
    activate(event: Event): void {
        activateAsClick(event, this.host, this.disabled());
    }
}

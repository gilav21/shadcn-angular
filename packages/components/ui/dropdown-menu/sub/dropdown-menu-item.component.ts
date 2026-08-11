import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from '@angular/core';
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
        '[attr.role]': '"menuitem"',
        '[attr.tabindex]': '"-1"',
        '(click)': 'onClick()',
        '(keydown.enter)': 'onClick()',
        '(keydown.space)': 'onKeydownSpace($event)',
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
     * Closes the menu on activation (click or Enter). It does not invoke
     * anything itself — bind your own `(click)` for the action; that handler
     * still fires while {@link disabled}, since only the close is guarded here.
     */
    onClick(): void {
        if (!this.disabled()) {
            this.menu?.hide();
        }
    }

    /**
     * Space activation, with the default suppressed so the page behind the menu
     * does not scroll.
     */
    onKeydownSpace(event: Event): void {
        event.preventDefault();
        this.onClick();
    }
}

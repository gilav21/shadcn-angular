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
        '[attr.tabindex]': '"0"',
        '(click)': 'onClick()',
        '(keydown.enter)': 'onClick()',
        '(keydown.space)': 'onKeydownSpace($event)',
    },
})
export class DropdownMenuItemComponent {
    class = input('');
    disabled = input(false, { transform: booleanAttribute });
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

    inset = input(false, { transform: booleanAttribute });

    onClick(): void {
        if (!this.disabled()) {
            this.menu?.hide();
        }
    }

    onKeydownSpace(event: Event): void {
        event.preventDefault();
        this.onClick();
    }
}

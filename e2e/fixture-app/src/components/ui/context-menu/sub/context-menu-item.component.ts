import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '@/components/lib/utils';
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

    class = input('');
    inset = input(false);
    variant = input<'default' | 'destructive'>('default');
    disabled = input(false);
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

    onClick(): void {
        if (!this.disabled()) {
            this.contextMenu?.close();
        }
    }
}

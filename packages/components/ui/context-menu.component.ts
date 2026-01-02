import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    ElementRef,
    OnDestroy,
    forwardRef,
    InjectionToken,
    ViewChild,
    effect,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../lib/utils';

export const CONTEXT_MENU = new InjectionToken<ContextMenuComponent>('CONTEXT_MENU');

@Component({
    selector: 'ui-context-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'contents',
        '[attr.data-slot]': '"context-menu"',
    },
    providers: [{ provide: CONTEXT_MENU, useExisting: forwardRef(() => ContextMenuComponent) }],
})
export class ContextMenuComponent implements OnDestroy {
    private document = inject(DOCUMENT);

    open = signal(false);
    position = signal({ x: 0, y: 0 });

    private clickListener = (event: MouseEvent) => {
        this.close();
    };

    private escListener = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            this.close();
        }
    };

    private scrollListener = () => {
        this.close();
    };

    constructor() {
        this.document.addEventListener('click', this.clickListener);
        this.document.addEventListener('keydown', this.escListener);
        this.document.addEventListener('scroll', this.scrollListener, true); // capture phase to catch all scrolls
    }

    ngOnDestroy() {
        this.document.removeEventListener('click', this.clickListener);
        this.document.removeEventListener('keydown', this.escListener);
        this.document.removeEventListener('scroll', this.scrollListener, true);
    }

    show(x: number, y: number) {
        this.position.set({ x, y });
        this.open.set(true);
    }

    close() {
        this.open.set(false);
    }
}

@Component({
    selector: 'ui-context-menu-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span 
      (contextmenu)="onContextMenu($event)"
      [attr.data-slot]="'context-menu-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class ContextMenuTriggerComponent {
    private contextMenu = inject(CONTEXT_MENU, { optional: true });

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
        this.contextMenu?.show(event.clientX, event.clientY);
    }
}

@Component({
    selector: 'ui-context-menu-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (contextMenu?.open()) {
      <div
        #contentEl
        [class]="classes()"
        [style.position]="'fixed'"
        [style.left.px]="adjustedPosition().x"
        [style.top.px]="adjustedPosition().y"
        [attr.data-state]="contextMenu?.open() ? 'open' : 'closed'"
        [attr.data-slot]="'context-menu-content'"
        (click)="$event.stopPropagation()"
      >
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class ContextMenuContentComponent {
    contextMenu = inject(CONTEXT_MENU, { optional: true });
    private document = inject(DOCUMENT);
    class = input('');

    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    adjustedPosition = signal({ x: 0, y: 0 });

    constructor() {
        effect(() => {
            if (this.contextMenu?.open()) {
                const pos = this.contextMenu.position();
                this.adjustedPosition.set({ x: pos.x, y: pos.y });
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.calculatePosition();
                    });
                });
            }
        });
    }

    private calculatePosition() {
        if (!this.contentEl?.nativeElement) return;

        const content = this.contentEl.nativeElement;
        const rect = content.getBoundingClientRect();
        const viewportWidth = this.document.defaultView?.innerWidth ?? 0;
        const viewportHeight = this.document.defaultView?.innerHeight ?? 0;
        const pos = this.contextMenu?.position() ?? { x: 0, y: 0 };

        let x = pos.x;
        let y = pos.y;

        // Check horizontal overflow
        if (rect.right > viewportWidth) {
            x = viewportWidth - rect.width - 8;
        }
        if (x < 8) {
            x = 8;
        }

        // Check vertical overflow
        if (rect.bottom > viewportHeight) {
            y = viewportHeight - rect.height - 8;
        }
        if (y < 8) {
            y = 8;
        }

        this.adjustedPosition.set({ x, y });
    }

    classes = computed(() => cn(
        'z-50 min-w-[8rem] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        this.class()
    ));
}

@Component({
    selector: 'ui-context-menu-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"context-menu-item"',
        '[attr.data-inset]': 'inset()',
        '[attr.data-variant]': 'variant()',
        '(click)': 'onClick()',
    },
})
export class ContextMenuItemComponent {
    private contextMenu = inject(CONTEXT_MENU, { optional: true });

    class = input('');
    inset = input(false);
    variant = input<'default' | 'destructive'>('default');
    disabled = input(false);

    classes = computed(() => cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
        'focus:bg-accent focus:text-accent-foreground',
        'hover:bg-accent hover:text-accent-foreground',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        this.inset() && 'pl-8',
        this.variant() === 'destructive' && 'text-destructive focus:bg-destructive/10 focus:text-destructive',
        this.disabled() && 'pointer-events-none opacity-50',
        this.class()
    ));

    onClick() {
        if (!this.disabled()) {
            this.contextMenu?.close();
        }
    }
}

@Component({
    selector: 'ui-context-menu-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        class: '-mx-1 my-1 h-px bg-border',
        '[attr.data-slot]': '"context-menu-separator"',
    },
})
export class ContextMenuSeparatorComponent { }

@Component({
    selector: 'ui-context-menu-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"context-menu-label"',
        '[attr.data-inset]': 'inset()',
    },
})
export class ContextMenuLabelComponent {
    class = input('');
    inset = input(false);

    classes = computed(() => cn(
        'px-2 py-1.5 text-sm font-semibold text-foreground',
        this.inset() && 'pl-8',
        this.class()
    ));
}

@Component({
    selector: 'ui-context-menu-shortcut',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'ml-auto text-xs tracking-widest text-muted-foreground',
        '[attr.data-slot]': '"context-menu-shortcut"',
    },
})
export class ContextMenuShortcutComponent { }

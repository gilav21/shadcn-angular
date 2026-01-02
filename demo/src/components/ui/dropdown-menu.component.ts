import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    ElementRef,
    OnDestroy,
    booleanAttribute,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../lib/utils';

@Component({
    selector: 'ui-dropdown-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'relative inline-block' },
})
export class DropdownMenuComponent implements OnDestroy {
    private el = inject(ElementRef);
    private document = inject(DOCUMENT);
    open = signal(false);

    private clickListener = (event: MouseEvent) => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.hide();
        }
    };

    constructor() {
        this.document.addEventListener('click', this.clickListener);
    }

    ngOnDestroy() {
        this.document.removeEventListener('click', this.clickListener);
    }

    toggle() {
        this.open.update(v => !v);
    }

    show() {
        this.open.set(true);
    }

    hide() {
        this.open.set(false);
    }
}

@Component({
    selector: 'ui-dropdown-menu-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span (click)="onClick($event)" [attr.data-slot]="'dropdown-trigger'">
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DropdownMenuTriggerComponent {
    private menu = inject(DropdownMenuComponent, { optional: true });

    onClick(event: MouseEvent) {
        event.stopPropagation();
        this.menu?.toggle();
    }
}

@Component({
    selector: 'ui-dropdown-menu-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (menu?.open()) {
      <div [class]="classes()" [attr.data-slot]="'dropdown-content'">
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class DropdownMenuContentComponent {
    menu = inject(DropdownMenuComponent, { optional: true });
    class = input('');
    align = input<'start' | 'center' | 'end'>('start');

    classes = computed(() => {
        const alignClasses = {
            start: 'left-0',
            center: 'left-1/2 -translate-x-1/2',
            end: 'right-0',
        };
        return cn(
            'absolute top-full z-50 mt-1 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            alignClasses[this.align()],
            this.class()
        );
    });
}

@Component({
    selector: 'ui-dropdown-menu-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        '[class]': 'classes()',
        '[attr.data-slot]': '"dropdown-item"',
        '(click)': 'onClick()',
    },
})
export class DropdownMenuItemComponent {
    class = input('');
    disabled = input(false, { transform: booleanAttribute });

    private menu = inject(DropdownMenuComponent, { optional: true });

    classes = computed(() =>
        cn(
            'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground',
            this.disabled() && 'pointer-events-none opacity-50',
            this.class()
        )
    );

    onClick() {
        if (!this.disabled()) {
            this.menu?.hide();
        }
    }
}

@Component({
    selector: 'ui-dropdown-menu-separator',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ``,
    host: {
        class: '-mx-1 my-1 h-px bg-border',
        '[attr.data-slot]': '"dropdown-separator"',
    },
})
export class DropdownMenuSeparatorComponent { }

@Component({
    selector: 'ui-dropdown-menu-label',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'px-2 py-1.5 text-sm font-semibold',
        '[attr.data-slot]': '"dropdown-label"',
    },
})
export class DropdownMenuLabelComponent { }

@Component({
    selector: 'ui-dropdown-menu-sub',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: { class: 'relative block w-full' },
})
export class DropdownMenuSubComponent {
    isOpen = signal(false);
    private timeoutId: any;

    enter() {
        clearTimeout(this.timeoutId);
        this.isOpen.set(true);
    }

    leave() {
        this.timeoutId = setTimeout(() => {
            this.isOpen.set(false);
        }, 100);
    }
}

@Component({
    selector: 'ui-dropdown-menu-sub-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div 
      [class]="classes()"
      role="menuitem"
      [attr.aria-haspopup]="true"
      [attr.aria-expanded]="sub.isOpen()"
      (mouseenter)="sub.enter()"
      (mouseleave)="sub.leave()"
    >
      <ng-content />
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" class="ml-auto h-4 w-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `,
    host: { class: 'contents' }
})
export class DropdownMenuSubTriggerComponent {
    class = input('');
    disabled = input(false, { transform: booleanAttribute });
    inset = input(false, { transform: booleanAttribute });

    sub = inject(DropdownMenuSubComponent);

    classes = computed(() => cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        this.sub.isOpen() && 'bg-accent text-accent-foreground',
        this.inset() && 'pl-8',
        this.class()
    ));
}

@Component({
    selector: 'ui-dropdown-menu-sub-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (sub.isOpen()) {
      <div 
        [class]="classes()" 
        role="menu"
        (mouseenter)="sub.enter()"
        (mouseleave)="sub.leave()"
      >
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' }
})
export class DropdownMenuSubContentComponent {
    class = input('');
    sub = inject(DropdownMenuSubComponent);

    classes = computed(() => cn(
        'absolute left-full top-0 z-50 ml-1 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in slide-in-from-left-1 fade-in-0 zoom-in-95',
        this.class()
    ));
}

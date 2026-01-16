import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    model,
    inject,
    ElementRef,
    OnDestroy,
    booleanAttribute,
    Injectable,
    ViewChild,
    effect,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn, isRtl } from '../lib/utils';

@Injectable()
export class DropdownMenuService {
    private triggerRef: HTMLElement | null = null;
    private rootEl: HTMLElement | null = null;

    registerRoot(el: HTMLElement) {
        this.rootEl = el;
    }

    registerTrigger(el: HTMLElement) {
        this.triggerRef = el;
    }

    focusTrigger() {
        this.triggerRef?.focus();
    }

    isRtl(): boolean {
        if (!this.rootEl) return false;
        return isRtl(this.rootEl);
    }
}

@Component({
    selector: 'ui-dropdown-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [DropdownMenuService],
    template: `<ng-content />`,
    host: {
        class: 'relative inline-block',
    },
})
export class DropdownMenuComponent implements OnDestroy {
    private el = inject(ElementRef);
    private document = inject(DOCUMENT);
    private service = inject(DropdownMenuService);

    open = model(false);

    constructor() {
        this.document.addEventListener('click', this.clickListener);
        this.service.registerRoot(this.el.nativeElement);
    }

    private clickListener = (event: MouseEvent) => {
        if (!this.el.nativeElement.contains(event.target)) {
            this.hide();
        }
    };

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
    <span 
      #trigger
      (click)="onClick($event)" 
      (keydown)="onKeydown($event)"
      [attr.data-slot]="'dropdown-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class DropdownMenuTriggerComponent {
    private menu = inject(DropdownMenuComponent, { optional: true });
    private service = inject(DropdownMenuService);
    private el = inject(ElementRef);

    @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

    constructor() {
        setTimeout(() => {
            const triggerButton = this.el.nativeElement.querySelector('[data-slot="dropdown-trigger"]') as HTMLElement;
            if (triggerButton) {
                this.service.registerTrigger(triggerButton);
            }
        });
    }

    onClick(event: MouseEvent) {
        event.stopPropagation();
        this.menu?.toggle();
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
            event.preventDefault();
            this.menu?.show();
        }
    }
}

@Component({
    selector: 'ui-dropdown-menu-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (menu?.open()) {
      <div 
        [class]="classes()" 
        [attr.data-slot]="'dropdown-content'"
        role="menu"
        (keydown)="onKeydown($event)"
      >
        <ng-content />
      </div>
    }
  `,
    host: { class: 'contents' },
})
export class DropdownMenuContentComponent {
    menu = inject(DropdownMenuComponent, { optional: true });
    service = inject(DropdownMenuService);
    el = inject(ElementRef);
    private document = inject(DOCUMENT);
    class = input('');
    align = input<'start' | 'center' | 'end'>('start');

    classes = computed(() => {
        const alignClasses = {
            start: 'ltr:left-0 rtl:right-0',
            center: 'left-1/2 -translate-x-1/2',
            end: 'ltr:right-0 rtl:left-0',
        };
        return cn(
            'absolute top-full z-50 mt-1 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            alignClasses[this.align()],
            this.class()
        );
    });

    constructor() {
        effect(() => {
            if (this.menu?.open()) {
                setTimeout(() => {
                    this.focusFirstItem();
                });
            }
        });
    }

    focusFirstItem() {
        const item = this.el.nativeElement.querySelector('[role="menuitem"]:not([data-disabled])') as HTMLElement;
        item?.focus();
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.focusNextItem(event.target as HTMLElement);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.focusPrevItem(event.target as HTMLElement);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.menu?.hide();
            this.service.focusTrigger();
        } else if (event.key === 'Tab') {
            event.preventDefault();
            const items = this.getFocusableItems();
            if (items.length === 0) return;

            const firstItem = items[0];
            const lastItem = items[items.length - 1];
            const activeElement = this.document.activeElement as HTMLElement;

            if (event.shiftKey) {
                if (activeElement === firstItem) {
                    lastItem.focus();
                } else {
                    this.focusPrevItem(activeElement);
                }
            } else {
                if (activeElement === lastItem) {
                    firstItem.focus();
                } else {
                    this.focusNextItem(activeElement);
                }
            }
        }
    }

    focusNextItem(currentItem: HTMLElement) {
        const items = this.getFocusableItems();
        const index = items.indexOf(currentItem);
        const nextIndex = (index + 1) % items.length;
        items[nextIndex]?.focus();
    }

    focusPrevItem(currentItem: HTMLElement) {
        const items = this.getFocusableItems();
        const index = items.indexOf(currentItem);
        const prevIndex = (index - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
    }

    getFocusableItems(): HTMLElement[] {
        return Array.from(this.el.nativeElement.querySelectorAll('[role="menuitem"]:not([data-disabled])')) as HTMLElement[];
    }
}

@Component({
    selector: 'ui-dropdown-menu-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
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

    private menu = inject(DropdownMenuComponent, { optional: true });

    classes = computed(() =>
        cn(
            'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground',
            this.disabled() && 'pointer-events-none opacity-50',
            this.inset() && 'ltr:pl-8 rtl:pr-8',
            this.class()
        )
    );

    inset = input(false, { transform: booleanAttribute });

    onClick() {
        if (!this.disabled()) {
            this.menu?.hide();
        }
    }

    onKeydownSpace(event: Event) {
        event.preventDefault();
        this.onClick();
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
    private timeoutId: ReturnType<typeof setTimeout> | undefined;

    private trigger: DropdownMenuSubTriggerComponent | null = null;
    private content: DropdownMenuSubContentComponent | null = null;

    registerTrigger(t: DropdownMenuSubTriggerComponent) { this.trigger = t; }
    registerContent(c: DropdownMenuSubContentComponent) { this.content = c; }

    enter() {
        clearTimeout(this.timeoutId);
        this.isOpen.set(true);
    }

    leave() {
        this.timeoutId = setTimeout(() => {
            this.isOpen.set(false);
        }, 100);
    }

    focusTrigger() {
        setTimeout(() => {
            this.trigger?.focus();
        }, 0);
    }

    focusContent() {
        setTimeout(() => {
            this.content?.focusFirst();
        }, 0);
    }
}

@Component({
    selector: 'ui-dropdown-menu-sub-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div 
      #trigger
      [class]="classes()"
      role="menuitem"
      tabindex="0"
      [attr.aria-haspopup]="true"
      [attr.aria-expanded]="sub.isOpen()"
      (mouseenter)="sub.enter()"
      (mouseleave)="sub.leave()"
      (keydown)="onKeydown($event)"
      (click)="onClick()"
    >
      <ng-content />
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `,
    host: { class: 'contents' }
})
export class DropdownMenuSubTriggerComponent {
    class = input('');
    disabled = input(false, { transform: booleanAttribute });
    inset = input(false, { transform: booleanAttribute });

    sub = inject(DropdownMenuSubComponent);
    service = inject(DropdownMenuService);
    el = inject(ElementRef);

    @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

    constructor() {
        this.sub.registerTrigger(this);
    }

    classes = computed(() => cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        this.sub.isOpen() && 'bg-accent text-accent-foreground',
        this.inset() && 'ltr:pl-8 rtl:pr-8',
        this.class()
    ));

    onClick() { }

    focus() {
        this.triggerEl?.nativeElement.focus();
    }

    onKeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowRight') {
            if (this.service.isRtl()) return;
            event.preventDefault();
            event.stopPropagation();
            this.sub.enter();
            this.sub.focusContent();
        }
        if (event.key === 'ArrowLeft') {
            if (this.service.isRtl()) {
                event.preventDefault();
                event.stopPropagation();
                this.sub.enter();
                this.sub.focusContent();
            }
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            this.sub.enter();
            this.sub.focusContent();
        }
    }
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
        (keydown)="onKeydown($event)"
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
    service = inject(DropdownMenuService);
    el = inject(ElementRef);

    constructor() {
        this.sub.registerContent(this);
    }

    classes = computed(() => cn(
        'absolute top-0 z-50 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'ltr:left-full ltr:ml-1 ltr:animate-in ltr:slide-in-from-left-1 ltr:fade-in-0 ltr:zoom-in-95',
        'rtl:right-full rtl:mr-1 rtl:animate-in rtl:slide-in-from-right-1 rtl:fade-in-0 rtl:zoom-in-95',
        this.class()
    ));

    focusFirst() {
        const items = Array.from(this.el.nativeElement.querySelectorAll('[role="menuitem"]:not([data-disabled])')) as HTMLElement[];
        items[0]?.focus();
    }

    onKeydown(event: KeyboardEvent) {
        event.stopPropagation();

        if (event.key === 'ArrowLeft') {
            if (!this.service.isRtl()) {
                event.preventDefault();
                this.sub.leave();
                this.sub.focusTrigger();
            }
        } else if (event.key === 'ArrowRight') {
            if (this.service.isRtl()) {
                event.preventDefault();
                this.sub.leave();
                this.sub.focusTrigger();
            }
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.focusNextItem(event.target as HTMLElement);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.focusPrevItem(event.target as HTMLElement);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.sub.leave();
            this.sub.focusTrigger();
        }
    }

    focusNextItem(currentItem: HTMLElement) {
        const div = (currentItem.closest('[role="menu"]') || currentItem) as HTMLElement;
        const items = Array.from(div.querySelectorAll('[role="menuitem"]:not([data-disabled])')) as HTMLElement[];
        const index = items.indexOf(currentItem);
        const nextIndex = (index + 1) % items.length;
        items[nextIndex]?.focus();
    }

    focusPrevItem(currentItem: HTMLElement) {
        const div = (currentItem.closest('[role="menu"]') || currentItem) as HTMLElement;
        const items = Array.from(div.querySelectorAll('[role="menuitem"]:not([data-disabled])')) as HTMLElement[];
        const index = items.indexOf(currentItem);
        const prevIndex = (index - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
    }
}

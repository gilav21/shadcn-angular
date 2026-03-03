import {
    Component,
    ChangeDetectionStrategy,
    Directive,
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
    TemplateRef,
    ViewContainerRef,
    EmbeddedViewRef,
    booleanAttribute,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { cn, isRtl } from '../lib/utils';

export interface ContextMenuItem {
    label?: string;
    value?: string;
    icon?: string;
    shortcut?: string;
    disabled?: boolean;
    type?: 'item' | 'separator' | 'label' | 'sub';
    children?: ContextMenuItem[];
    inset?: boolean;
    click?: (item: ContextMenuItem) => void;
}

export const CONTEXT_MENU = new InjectionToken<ContextMenuComponent>('CONTEXT_MENU');

@Component({
    selector: 'ui-context-menu',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        NgTemplateOutlet,
        forwardRef(() => ContextMenuContentComponent),
        forwardRef(() => ContextMenuItemComponent),
        forwardRef(() => ContextMenuLabelComponent),
        forwardRef(() => ContextMenuSeparatorComponent),
        forwardRef(() => ContextMenuSubComponent),
        forwardRef(() => ContextMenuSubTriggerComponent),
        forwardRef(() => ContextMenuSubContentComponent),
    ],
    template: `
      <ng-content />
      @if (items().length > 0) {
        <ui-context-menu-content>
          <ng-container *ngTemplateOutlet="menuItemsTpl; context: { $implicit: items() }"></ng-container>
        </ui-context-menu-content>
      }

      <ng-template #menuItemsTpl let-items>
        @for (item of items; track $index) {
          @if (item.type === 'separator') {
              <ui-context-menu-separator />
          } @else if (item.type === 'label') {
              <ui-context-menu-label [inset]="item.inset">{{ item.label }}</ui-context-menu-label>
          } @else if (item.type === 'sub') {
               <ui-context-menu-sub>
                  <ui-context-menu-sub-trigger [inset]="item.inset" [disabled]="item.disabled">
                      {{ item.label }}
                  </ui-context-menu-sub-trigger>
                  <ui-context-menu-sub-content>
                      <ng-container *ngTemplateOutlet="menuItemsTpl; context: { $implicit: item.children }"></ng-container>
                  </ui-context-menu-sub-content>
               </ui-context-menu-sub>
          } @else {
               <ui-context-menu-item
                  [disabled]="item.disabled"
                  [inset]="item.inset"
                  [shortcut]="item.shortcut"
                  (click)="item.click ? item.click(item) : null">
                  {{ item.label }}
               </ui-context-menu-item>
          }
        }
      </ng-template>
    `,
    host: {
        class: 'contents',
        '[attr.data-slot]': '"context-menu"',
    },
    providers: [{ provide: CONTEXT_MENU, useExisting: forwardRef(() => ContextMenuComponent) }],
})
export class ContextMenuComponent implements OnDestroy {
    private readonly document = inject(DOCUMENT);
    private readonly el = inject(ElementRef);

    items = input<ContextMenuItem[]>([]);
    open = signal(false);
    position = signal({ x: 0, y: 0 });
    data = signal<any>(undefined);

    private readonly clickListener = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest('[data-context-menu-portal]') || target.closest('[data-context-menu-sub-portal]')) {
            return;
        }
        this.close();
    };

    private readonly escListener = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            this.close();
        }
    };

    private readonly scrollListener = () => {
        this.close();
    };

    constructor() {
        this.document.addEventListener('click', this.clickListener, true);
        this.document.addEventListener('keydown', this.escListener);
        this.document.addEventListener('scroll', this.scrollListener, true);
    }

    ngOnDestroy() {
        this.document.removeEventListener('click', this.clickListener, true);
        this.document.removeEventListener('keydown', this.escListener);
        this.document.removeEventListener('scroll', this.scrollListener, true);
    }

    show(x: number, y: number, data?: any) {
        this.position.set({ x, y });
        this.data.set(data);
        this.open.set(true);
    }

    close() {
        this.open.set(false);
    }

    isRtl(): boolean {
        return isRtl(this.el.nativeElement);
    }
}

@Component({
    selector: 'ui-context-menu-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span 
        class="contents"
        (contextmenu)="onContextMenu($event)"
        [attr.data-slot]="'context-menu-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class ContextMenuTriggerComponent {
    private readonly contextMenu = inject(CONTEXT_MENU, { optional: true });

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
        this.contextMenu?.show(event.clientX, event.clientY);
    }
}

@Component({
    selector: 'ui-context-menu-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <ng-template #contentTemplate>
      <div
        #contentEl
        [class]="classes()"
        [style.position]="'fixed'"
        [style.left.px]="adjustedPosition().x"
        [style.top.px]="adjustedPosition().y"
        [style.z-index]="9999"
        [attr.data-state]="contextMenu?.open() ? 'open' : 'closed'"
        [attr.data-slot]="'context-menu-content'"
      >
        <ng-content />
      </div>
    </ng-template>
  `,
    host: { class: 'contents' },
})
export class ContextMenuContentComponent implements OnDestroy {
    readonly contextMenu = inject(CONTEXT_MENU, { optional: true });
    private readonly document = inject(DOCUMENT);

    class = input('');

    @ViewChild('contentTemplate', { static: true }) contentTemplate!: TemplateRef<any>;
    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    private readonly viewContainerRef = inject(ViewContainerRef);
    private embeddedViewRef: EmbeddedViewRef<any> | null = null;
    private portalHost: HTMLElement | null = null;

    adjustedPosition = signal({ x: 0, y: 0 });

    constructor() {
        effect(() => {
            if (this.contextMenu?.open()) {
                const pos = this.contextMenu.position();
                this.adjustedPosition.set({ x: pos.x, y: pos.y });
                this.showContent();
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.calculatePosition();
                    });
                });
            } else {
                this.hideContent();
            }
        });
    }

    private showContent() {
        if (this.embeddedViewRef) return;

        this.portalHost = this.document.createElement('div');
        this.portalHost.dataset['contextMenuPortal'] = 'true';
        this.document.body.appendChild(this.portalHost);
        this.embeddedViewRef = this.viewContainerRef.createEmbeddedView(this.contentTemplate);
        this.embeddedViewRef.detectChanges();

        this.embeddedViewRef.rootNodes.forEach((node: Node) => {
            this.portalHost?.appendChild(node);
        });
    }

    private hideContent() {
        this.embeddedViewRef?.destroy();
        this.embeddedViewRef = null;
        this.portalHost?.remove();
        this.portalHost = null;
    }

    ngOnDestroy() {
        this.hideContent();
    }

    private calculatePosition() {
        if (!this.portalHost) return;

        const content = this.portalHost.querySelector<HTMLElement>('[data-slot="context-menu-content"]');
        if (!content) return;

        const rect = content.getBoundingClientRect();
        const viewportWidth = this.document.defaultView?.innerWidth ?? 0;
        const viewportHeight = this.document.defaultView?.innerHeight ?? 0;
        const pos = this.contextMenu?.position() ?? { x: 0, y: 0 };

        let x = pos.x;
        let y = pos.y;

        if (x + rect.width > viewportWidth) {
            x = viewportWidth - rect.width - 8;
        }
        if (x < 8) {
            x = 8;
        }

        if (y + rect.height > viewportHeight) {
            y = viewportHeight - rect.height - 8;
        }
        if (y < 8) {
            y = 8;
        }

        this.adjustedPosition.set({ x, y });
    }

    classes = computed(() => cn(
        'min-w-[8rem] max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        this.class()
    ));
}

@Component({
    selector: 'ui-context-menu-item',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <ng-content />
        @if (shortcut()) {
            <span class="ml-auto text-xs tracking-widest text-muted-foreground">{{ shortcut() }}</span>
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
        class: 'ltr:ml-auto rtl:mr-auto text-xs tracking-widest text-muted-foreground',
        '[attr.data-slot]': '"context-menu-shortcut"',
    },
})
export class ContextMenuShortcutComponent { }

@Component({
    selector: 'ui-context-menu-sub',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<ng-content />`,
    host: {
        class: 'relative block w-full',
        '[attr.data-slot]': '"context-menu-sub"',
    },
})
export class ContextMenuSubComponent {
    isOpen = signal(false);
    private timeoutId: ReturnType<typeof setTimeout> | undefined;

    private trigger: ContextMenuSubTriggerComponent | null = null;
    private content: ContextMenuSubContentComponent | null = null;

    registerTrigger(t: ContextMenuSubTriggerComponent) { this.trigger = t; }
    registerContent(c: ContextMenuSubContentComponent) { this.content = c; }

    getTriggerElement(): HTMLElement | null {
        return this.trigger?.triggerEl?.nativeElement ?? null;
    }

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
    selector: 'ui-context-menu-sub-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div
      #trigger
      [class]="classes()"
      role="menuitem"
      tabindex="0"
      [attr.aria-haspopup]="true"
      [attr.aria-expanded]="sub.isOpen()"
      [attr.data-slot]="'context-menu-sub-trigger'"
      (mouseenter)="sub.enter()"
      (mouseleave)="sub.leave()"
      (keydown)="onKeydown($event)"
      (click)="$event.stopPropagation()"
    >
      <ng-content />
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" class="h-4 w-4 ltr:ml-auto rtl:mr-auto rtl:rotate-180" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  `,
    host: { class: 'contents' },
})
export class ContextMenuSubTriggerComponent {
    class = input('');
    disabled = input(false, { transform: booleanAttribute });
    inset = input(false, { transform: booleanAttribute });

    readonly sub = inject(ContextMenuSubComponent);
    private readonly contextMenu = inject(CONTEXT_MENU, { optional: true });
    readonly el = inject(ElementRef);

    @ViewChild('trigger') triggerEl!: ElementRef<HTMLElement>;

    constructor() {
        this.sub.registerTrigger(this);
    }

    classes = computed(() => cn(
        'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        this.sub.isOpen() && 'bg-accent text-accent-foreground',
        this.inset() && 'ltr:pl-8 rtl:pr-8',
        this.class()
    ));

    focus() {
        this.triggerEl?.nativeElement.focus();
    }

    onKeydown(event: KeyboardEvent) {
        const rtl = this.contextMenu?.isRtl() ?? false;
        if (event.key === 'ArrowRight') {
            if (rtl) return;
            event.preventDefault();
            event.stopPropagation();
            this.sub.enter();
            this.sub.focusContent();
        }
        if (event.key === 'ArrowLeft') {
            if (rtl) {
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
    selector: 'ui-context-menu-sub-content',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <ng-template #subContentTemplate>
      <div
        #subContentEl
        [class]="classes()"
        [style.position]="'fixed'"
        [style.left.px]="portalPosition().x"
        [style.top.px]="portalPosition().y"
        [style.z-index]="10000"
        role="menu"
        [attr.data-slot]="'context-menu-sub-content'"
        (mouseenter)="sub.enter()"
        (mouseleave)="sub.leave()"
        (keydown)="onKeydown($event)"
      >
        <ng-content />
      </div>
    </ng-template>
  `,
    host: { class: 'contents' },
})
export class ContextMenuSubContentComponent implements OnDestroy {
    class = input('');
    readonly sub = inject(ContextMenuSubComponent);
    private readonly contextMenu = inject(CONTEXT_MENU, { optional: true });
    private readonly document = inject(DOCUMENT);
    private readonly viewContainerRef = inject(ViewContainerRef);
    readonly el = inject(ElementRef);

    @ViewChild('subContentTemplate', { static: true }) subContentTemplate!: TemplateRef<any>;
    @ViewChild('subContentEl') subContentEl?: ElementRef<HTMLElement>;

    private embeddedViewRef: EmbeddedViewRef<any> | null = null;
    private portalHost: HTMLElement | null = null;
    portalPosition = signal({ x: 0, y: 0 });

    constructor() {
        this.sub.registerContent(this);
        effect(() => {
            if (this.sub.isOpen()) {
                this.showPortal();
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.calculatePosition();
                    });
                });
            } else {
                this.hidePortal();
            }
        });
    }

    private showPortal() {
        if (this.embeddedViewRef) return;

        this.portalHost = this.document.createElement('div');
        this.portalHost.dataset['contextMenuSubPortal'] = 'true';
        this.document.body.appendChild(this.portalHost);
        this.embeddedViewRef = this.viewContainerRef.createEmbeddedView(this.subContentTemplate);
        this.embeddedViewRef.detectChanges();

        this.embeddedViewRef.rootNodes.forEach((node: Node) => {
            this.portalHost?.appendChild(node);
        });
    }

    private hidePortal() {
        if (this.embeddedViewRef) {
            this.embeddedViewRef.destroy();
            this.embeddedViewRef = null;
        }
        if (this.portalHost) {
            this.portalHost.remove();
            this.portalHost = null;
        }
    }

    private calculatePosition() {
        if (!this.portalHost) return;

        const triggerEl = this.sub.getTriggerElement();
        if (!triggerEl) return;

        const content = this.portalHost.querySelector<HTMLElement>('[data-slot="context-menu-sub-content"]');
        if (!content) return;

        const triggerRect = triggerEl.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const viewportWidth = this.document.defaultView?.innerWidth ?? 0;
        const viewportHeight = this.document.defaultView?.innerHeight ?? 0;
        const rtl = this.contextMenu?.isRtl() ?? false;

        let x: number;
        let y = triggerRect.top;

        if (rtl) {
            x = triggerRect.left - contentRect.width - 4;
            if (x < 8) {
                x = triggerRect.right + 4;
            }
        } else {
            x = triggerRect.right + 4;
            if (x + contentRect.width > viewportWidth - 8) {
                x = triggerRect.left - contentRect.width - 4;
            }
        }

        if (x < 8) x = 8;
        if (x + contentRect.width > viewportWidth - 8) {
            x = viewportWidth - contentRect.width - 8;
        }

        if (y + contentRect.height > viewportHeight - 8) {
            y = viewportHeight - contentRect.height - 8;
        }
        if (y < 8) y = 8;

        this.portalPosition.set({ x, y });
    }

    ngOnDestroy() {
        this.hidePortal();
    }

    classes = computed(() => cn(
        'min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        this.class()
    ));

    focusFirst() {
        if (!this.portalHost) return;
        const items = Array.from(this.portalHost.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        items[0]?.focus();
    }

    onKeydown(event: KeyboardEvent) {
        event.stopPropagation();
        const rtl = this.contextMenu?.isRtl() ?? false;

        if (event.key === 'ArrowLeft') {
            if (!rtl) {
                event.preventDefault();
                this.sub.leave();
                this.sub.focusTrigger();
            }
        } else if (event.key === 'ArrowRight') {
            if (rtl) {
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
        const div = currentItem.closest<HTMLElement>('[role="menu"]') || currentItem;
        const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        const index = items.indexOf(currentItem);
        const nextIndex = (index + 1) % items.length;
        items[nextIndex]?.focus();
    }

    focusPrevItem(currentItem: HTMLElement) {
        const div = currentItem.closest<HTMLElement>('[role="menu"]') || currentItem;
        const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        const index = items.indexOf(currentItem);
        const prevIndex = (index - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
    }
}

/**
 * ContextMenuTriggerDirective - Directive version for use on any element
 *
 * Usage:
 * <ui-context-menu #contextMenu>
 *   <ui-context-menu-content>
 *     <ui-context-menu-item>Action 1</ui-context-menu-item>
 *     <ui-context-menu-item>Action 2</ui-context-menu-item>
 *   </ui-context-menu-content>
 * </ui-context-menu>
 *
 * <div [uiContextMenuTrigger]="contextMenu">
 *   Right-click anywhere here
 * </div>
 */
@Directive({
    selector: '[uiContextMenuTrigger]',
    host: {
        '(contextmenu)': 'onContextMenu($event)',
        '(click)': 'onClick($event)',
    },
})
export class ContextMenuTriggerDirective {
    uiContextMenuTrigger = input.required<ContextMenuComponent>();

    onContextMenu(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();

        const contextMenu = this.uiContextMenuTrigger();
        if (!contextMenu) return;

        contextMenu.show(event.clientX, event.clientY);
    }

    onClick(event: MouseEvent) {
        const contextMenu = this.uiContextMenuTrigger();
        if (contextMenu?.open()) {
            contextMenu.close();
        }
    }
}

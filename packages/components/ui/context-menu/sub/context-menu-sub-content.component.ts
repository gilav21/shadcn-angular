import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    signal,
    inject,
    ElementRef,
    OnDestroy,
    ViewChild,
    effect,
    TemplateRef,
    ViewContainerRef,
    EmbeddedViewRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { cn } from '../../../lib/utils';
import { CONTEXT_MENU } from '../context-menu.component';
import { CONTEXT_MENU_SUB, type ContextMenuSubComponent } from './context-menu-sub.component';

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
        tabindex="-1"
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
    readonly sub = inject(CONTEXT_MENU_SUB) as ContextMenuSubComponent;
    private readonly contextMenu = inject(CONTEXT_MENU, { optional: true });
    private readonly document = inject(DOCUMENT);
    private readonly viewContainerRef = inject(ViewContainerRef);
    readonly el = inject(ElementRef);

    @ViewChild('subContentTemplate', { static: true }) subContentTemplate!: TemplateRef<unknown>;
    @ViewChild('subContentEl') subContentEl?: ElementRef<HTMLElement>;

    private embeddedViewRef: EmbeddedViewRef<unknown> | null = null;
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

    private showPortal(): void {
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

    private hidePortal(): void {
        if (this.embeddedViewRef) {
            this.embeddedViewRef.destroy();
            this.embeddedViewRef = null;
        }
        if (this.portalHost) {
            this.portalHost.remove();
            this.portalHost = null;
        }
    }

    private resolveX(triggerRect: DOMRect, contentRect: DOMRect, viewportWidth: number, rtl: boolean): number {
        let x: number;
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
        return x;
    }

    private resolveY(triggerRect: DOMRect, contentRect: DOMRect, viewportHeight: number): number {
        let y = triggerRect.top;
        if (y + contentRect.height > viewportHeight - 8) {
            y = viewportHeight - contentRect.height - 8;
        }
        if (y < 8) y = 8;
        return y;
    }

    private calculatePosition(): void {
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

        const x = this.resolveX(triggerRect, contentRect, viewportWidth, rtl);
        const y = this.resolveY(triggerRect, contentRect, viewportHeight);

        this.portalPosition.set({ x, y });
    }

    ngOnDestroy(): void {
        this.hidePortal();
    }

    classes = computed(() => cn(
        'min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        this.class()
    ));

    focusFirst(): void {
        if (!this.portalHost) return;
        const items = Array.from(this.portalHost.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        items[0]?.focus();
    }

    onKeydown(event: KeyboardEvent): void {
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

    focusNextItem(currentItem: HTMLElement): void {
        const div = currentItem.closest<HTMLElement>('[role="menu"]') ?? currentItem;
        const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        const index = items.indexOf(currentItem);
        const nextIndex = (index + 1) % items.length;
        items[nextIndex]?.focus();
    }

    focusPrevItem(currentItem: HTMLElement): void {
        const div = currentItem.closest<HTMLElement>('[role="menu"]') ?? currentItem;
        const items = Array.from(div.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
        const index = items.indexOf(currentItem);
        const prevIndex = (index - 1 + items.length) % items.length;
        items[prevIndex]?.focus();
    }
}

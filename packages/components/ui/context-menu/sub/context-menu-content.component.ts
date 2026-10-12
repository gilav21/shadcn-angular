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
import { inheritThemeTokens } from '../../../lib/theme-presets';
import { CONTEXT_MENU } from '../context-menu.component';

type RingMove = 'next' | 'prev' | 'first' | 'last';

const RING_MOVES: ReadonlyMap<string, RingMove> = new Map<string, RingMove>([
    ['ArrowDown', 'next'],
    ['ArrowUp', 'prev'],
    ['Home', 'first'],
    ['End', 'last'],
]);

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
        role="menu"
        tabindex="-1"
        (keydown)="onKeydown($event)"
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

    /**
     * Extra classes for the floating panel, merged after the defaults
     * (`min-w-[8rem]`, popover colours, `max-w-[calc(100vw-16px)]` /
     * `max-h-[calc(100vh-16px)]` scroll clamps, enter animation). The panel is
     * portalled to `document.body` with `position: fixed` and `z-index: 9999`,
     * so apart from the theme tokens and the host's resolved `dir`, which are
     * copied onto the portal, it inherits nothing from the host — width,
     * padding and colours must be set here rather than on an ancestor. Avoid
     * overriding `position`/`left`/`top`: they are re-applied from the clamped
     * coordinates on every open.
     */
    class = input('');

    @ViewChild('contentTemplate', { static: true }) contentTemplate!: TemplateRef<unknown>;
    @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;

    private readonly viewContainerRef = inject(ViewContainerRef);
    private embeddedViewRef: EmbeddedViewRef<unknown> | null = null;
    private portalHost: HTMLElement | null = null;
    private returnFocusTo: HTMLElement | null = null;

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

    private showContent(): void {
        if (this.embeddedViewRef) return;

        this.returnFocusTo = this.activeElement();
        this.portalHost = this.document.createElement('div');
        this.portalHost.dataset['contextMenuPortal'] = 'true';
        this.document.body.appendChild(this.portalHost);
        const origin: HTMLElement = this.viewContainerRef.element.nativeElement;
        inheritThemeTokens(origin, this.portalHost);
        // Portalled to <body>, the panel would take the page's direction; it must lay out in the one its host resolves to.
        this.portalHost.dir = getComputedStyle(origin).direction;
        this.embeddedViewRef = this.viewContainerRef.createEmbeddedView(this.contentTemplate);
        this.embeddedViewRef.detectChanges();

        this.embeddedViewRef.rootNodes.forEach((node: Node) => {
            this.portalHost?.appendChild(node);
        });
    }

    /**
     * Closes the portal and hands focus back to where it was before the menu
     * opened. Only when focus is still the menu's own (inside a panel, or lost to
     * `<body>` when the panel's item was clicked away from): a user who moved on
     * to another field keeps it.
     */
    private hideContent(): void {
        const returnTo = this.focusBelongsToMenu() ? this.returnFocusTo : null;
        this.teardown();
        if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    }

    private teardown(): void {
        this.returnFocusTo = null;
        this.embeddedViewRef?.destroy();
        this.embeddedViewRef = null;
        this.portalHost?.remove();
        this.portalHost = null;
    }

    /** Destroying the menu with the page or view it lives in is not the user closing it: focus is not moved. */
    ngOnDestroy(): void {
        this.teardown();
    }

    private activeElement(): HTMLElement | null {
        const active = this.document.activeElement;
        return active instanceof HTMLElement && active !== this.document.body ? active : null;
    }

    private focusBelongsToMenu(): boolean {
        const active = this.activeElement();
        return !active || active.closest('[data-context-menu-portal], [data-context-menu-sub-portal]') !== null;
    }

    /** The panel's arrow-key ring: its own enabled items, sub-menu triggers included, in DOM order. */
    private ringItems(panel: HTMLElement): HTMLElement[] {
        return Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'))
            .filter(item => item.closest('[role="menu"]') === panel);
    }

    /** Opening a menu moves focus to its first enabled item, or to the panel when every item is disabled. */
    private focusInitial(panel: HTMLElement): void {
        if (panel.contains(this.document.activeElement)) return;
        (this.ringItems(panel)[0] ?? panel).focus({ preventScroll: true });
    }

    /**
     * Keyboard map for the open menu: ArrowDown/ArrowUp walk the enabled items
     * with wrap-around, Home/End jump to the ends, Tab closes the menu and
     * returns focus to where it was. Enter, Space and the sub-menu arrows belong
     * to the item that has focus. Escape is the overlay stack's.
     */
    onKeydown(event: KeyboardEvent): void {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.key === 'Tab') {
            event.preventDefault();
            this.contextMenu?.close();
            return;
        }
        const move = RING_MOVES.get(event.key);
        if (!move) return;
        event.preventDefault();
        this.focusRing(event.currentTarget as HTMLElement, move);
    }

    private focusRing(panel: HTMLElement, move: RingMove): void {
        const items = this.ringItems(panel);
        const current = items.indexOf(this.document.activeElement as HTMLElement);
        const last = items.length - 1;
        const index = {
            next: current === last ? 0 : current + 1,
            prev: current <= 0 ? last : current - 1,
            first: 0,
            last,
        }[move];
        items[index]?.focus();
    }

    private calculatePosition(): void {
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
        // The signal write alone never re-renders this relocated view: the clamp never reached the panel.
        this.embeddedViewRef?.detectChanges();
        this.focusInitial(content);
    }

    classes = computed(() => cn(
        'min-w-[8rem] outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        this.class()
    ));
}

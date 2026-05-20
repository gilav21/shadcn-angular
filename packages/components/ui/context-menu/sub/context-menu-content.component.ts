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

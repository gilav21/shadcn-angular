import {
    Component,
    ChangeDetectionStrategy,
    inject,
    ElementRef,
    OnDestroy,
    AfterViewInit,
    ViewChild,
} from '@angular/core';
import { onLongPress } from '@/components/lib/touch';
import { CONTEXT_MENU } from '../context-menu.component';

@Component({
    selector: 'ui-context-menu-trigger',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <span
        #triggerSpan
        class="contents"
        (contextmenu)="onContextMenu($event)"
        [attr.data-slot]="'context-menu-trigger'"
    >
      <ng-content />
    </span>
  `,
    host: { class: 'contents' },
})
export class ContextMenuTriggerComponent implements AfterViewInit, OnDestroy {
    private readonly contextMenu = inject(CONTEXT_MENU, { optional: true });

    @ViewChild('triggerSpan', { static: true }) private readonly triggerSpan!: ElementRef<HTMLElement>;

    private cleanupLongPress: (() => void) | null = null;

    ngAfterViewInit(): void {
        this.cleanupLongPress = onLongPress(this.triggerSpan.nativeElement, (event: TouchEvent) => {
            event.preventDefault();
            const touch = event.touches[0] ?? event.changedTouches[0];
            if (touch) {
                this.contextMenu?.show(touch.clientX, touch.clientY);
            }
        });
    }

    ngOnDestroy(): void {
        this.cleanupLongPress?.();
    }

    onContextMenu(event: MouseEvent): void {
        event.preventDefault();
        this.contextMenu?.show(event.clientX, event.clientY);
    }
}

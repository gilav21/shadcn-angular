import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    inject,
} from '@angular/core';
import { cn } from '../../../lib/utils';
import { SortableComponent } from '../sortable.component';

/** Wraps one rendered row inside ui-sortable. */
@Component({
    selector: 'ui-sortable-item',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './sortable-item.component.html',
    host: { class: 'contents' },
})
export class SortableItemComponent {
    readonly index = input.required<number>();
    readonly class = input('');

    private readonly parent = inject(SortableComponent, { optional: true }) as SortableComponent<unknown> | null;

    readonly disabled = computed(() => this.parent?.disabled() ?? false);

    readonly classes = computed(() => {
        const idx = this.index();
        const isSource = this.parent?.dragSource() === idx;
        const isLifted = this.parent?.liftedIndex() === idx;
        const bodyDraggable = !(this.parent?.handleOnly() ?? false) && !this.disabled();
        return cn(
            'relative flex items-center gap-2 select-none outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded',
            bodyDraggable ? 'touch-none' : '',
            isSource ? 'opacity-50 z-10' : '',
            isLifted ? 'ring-2 ring-primary ring-offset-1 rounded' : '',
            this.class(),
        );
    });

    readonly dragStyle = computed((): Record<string, string> => {
        const idx = this.index();
        if (this.parent?.dragSource() !== idx) return {};
        const delta = this.parent?.dragDelta() ?? { x: 0, y: 0 };
        return {
            transform: `translate(${delta.x}px, ${delta.y}px)`,
            position: 'relative',
            'z-index': '10',
        };
    });

    onMouseDown(event: MouseEvent): void {
        if (!this.parent || this.parent.handleOnly()) return;
        this.parent.startDrag(this.index(), event.clientX, event.clientY);
    }

    onTouchStart(event: TouchEvent): void {
        if (!this.parent || this.parent.handleOnly() || event.touches.length === 0) return;
        event.preventDefault();
        const touch = event.touches[0];
        this.parent.startDrag(this.index(), touch.clientX, touch.clientY);
    }

    onKeyDown(event: KeyboardEvent): void {
        this.parent?.handleItemKeyDown(this.index(), event);
    }
}

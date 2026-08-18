import {
    Component,
    ChangeDetectionStrategy,
    computed,
    signal,
    input,
    inject,
    ElementRef,
    NgZone,
    OnInit,
    OnDestroy,
    ContentChildren,
    QueryList,
    AfterContentInit,
    AfterViewInit,
    ViewChildren
} from '@angular/core';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { DockItemComponent } from './sub/dock-item.component';
import { DockIconComponent } from './sub/dock-icon.component';
import { DockLabelComponent } from './sub/dock-label.component';

const dockVariants = cva(
    'mx-auto w-max max-w-[calc(100vw-2rem)] overflow-x-auto mt-4 sm:mt-8 h-[50px] sm:h-[58px] p-1.5 sm:p-2 flex gap-1.5 sm:gap-2 rounded-2xl border supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 backdrop-blur-md',
    {
        variants: {
            position: {
                bottom: 'items-end',
                top: 'items-start',
                left: 'items-start flex-col',
                right: 'items-start flex-col',
            },
        },
        defaultVariants: {
            position: 'bottom',
        },
    }
);

export interface DockItemData {
    label?: string;
    icon?: string;
    class?: string;
    active?: boolean;
    href?: string;
    onClick?: () => void;
}

@Component({
    selector: 'ui-dock',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DockItemComponent, DockIconComponent, DockLabelComponent],
    templateUrl: './dock.component.html',
    host: { class: 'contents' },
})
export class DockComponent implements OnInit, OnDestroy, AfterContentInit, AfterViewInit {
    /** Extra classes merged onto the dock bar, after the position variant. The bar is already `max-w-[calc(100vw-2rem)]` with horizontal scroll, so it survives narrow phones. */
    class = input('');
    /** Peak icon width in px directly under the cursor; items rest at 40px. Values below 40 shrink icons on hover instead of growing them. */
    magnification = input<number>(60);
    /** How far, in px, the cursor's influence reaches. Width falls off on a cosine curve from {@link magnification} at the centre to the 40px base at this distance — a bigger value lifts more neighbours at once, it does not make them bigger. */
    distance = input<number>(100);
    /**
     * Where the dock is anchored, which sets its axis and alignment (`left`/`right`
     * stack the items in a column). The magnification follows the same axis, so a
     * vertical dock magnifies the item the cursor is beside rather than the whole
     * column.
     */
    position = input<'bottom' | 'top' | 'left' | 'right'>('bottom');
    /**
     * Simple mode: renders one item per entry. Ignored entirely once any
     * `ui-dock-item` is projected — custom content wins. An entry with an `href`
     * renders a link filling the item, one with only an `onClick` renders a
     * button, and an entry with neither stays decorative. Both are labelled from
     * `label` for screen readers.
     */
    items = input<DockItemData[]>([]);

    /** Whether the dock stacks its items in a column, which is also the axis the magnification measures along. */
    readonly isVertical = computed(() => this.position() === 'left' || this.position() === 'right');

    /** Runs a simple-mode entry's `onClick`, if it has one. Called from both the link and the button form, so an entry with an `href` and an `onClick` gets both. */
    activateItem(item: DockItemData): void {
        item.onClick?.();
    }

    @ContentChildren(DockItemComponent) private readonly projectedItems!: QueryList<DockItemComponent>;
    @ViewChildren(DockItemComponent) private readonly viewItems!: QueryList<DockItemComponent>;

    private readonly _hasCustomContent = signal(false);
    hasCustomContent = this._hasCustomContent.asReadonly();

    ngAfterContentInit(): void {
        this._hasCustomContent.set(this.projectedItems.length > 0);
    }

    classes = computed(() => cn(dockVariants({ position: this.position() }), this.class()));

    private readonly _el = inject(ElementRef);
    private readonly _ngZone = inject(NgZone);

    private _itemCenters: number[] = [];
    private readonly onMouseMoveBound = this.onMouseMove.bind(this);
    private readonly onMouseLeaveBound = this.onMouseLeave.bind(this);
    private readonly onMouseEnterBound = this.onMouseEnter.bind(this);

    private get allItems(): DockItemComponent[] {
        return [...(this.projectedItems?.toArray() || []), ...(this.viewItems?.toArray() || [])];
    }

    ngAfterViewInit(): void {
        this.recalculateItemCenters();
    }

    ngOnInit(): void {
        this._ngZone.runOutsideAngular(() => {
            this._el.nativeElement.addEventListener('mousemove', this.onMouseMoveBound);
            this._el.nativeElement.addEventListener('mouseleave', this.onMouseLeaveBound);
            this._el.nativeElement.addEventListener('mouseenter', this.onMouseEnterBound);
        });
    }

    ngOnDestroy(): void {
        this._el.nativeElement.removeEventListener('mousemove', this.onMouseMoveBound);
        this._el.nativeElement.removeEventListener('mouseleave', this.onMouseLeaveBound);
        this._el.nativeElement.removeEventListener('mouseenter', this.onMouseEnterBound);
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    private _rafId: number | null = null;
    private _pointerOffset: number = Infinity;

    /** Re-measures on entry so the dock magnifies correctly after the page has scrolled or reflowed since the last measurement. Runs outside Angular — it triggers no change detection. */
    onMouseEnter(): void {
        this.recalculateItemCenters();
    }

    /** Caches each item's viewport centre along the dock's axis (Y for `left`/`right`, X otherwise), the baseline the hover maths measures against. Call it after adding or removing items outside a mouse-enter, otherwise the magnification stays keyed to the old positions. */
    recalculateItemCenters(): void {
        const axis = this.isVertical() ? 'y' : 'x';
        this._itemCenters = this.allItems.map(item => item.getCenter(axis));
    }

    /**
     * Tracks the cursor along the dock's axis — `clientY` for `left`/`right`,
     * `clientX` otherwise — and schedules one width update per animation frame.
     * Bound outside Angular and it writes widths through `Renderer2` rather than
     * signals, so the magnification never triggers change detection. Mouse only —
     * there is no touch equivalent, so on a phone the dock simply stays at rest.
     */
    onMouseMove(e: MouseEvent): void {
        this._pointerOffset = this.isVertical() ? e.clientY : e.clientX;

        if (this._rafId) return;

        this._rafId = requestAnimationFrame(() => {
            this.updateItems();
            this._rafId = null;
        });
    }

    /** Drops the cursor position and settles every item back to the 40px base immediately, cancelling any frame still pending so a stale one cannot re-magnify after the pointer has gone. */
    onMouseLeave(): void {
        this._pointerOffset = Infinity;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this.updateItems();
    }

    /**
     * Applies the width each item should have for the current cursor position:
     * a cosine falloff from {@link magnification} at the centre to the 40px base
     * at {@link distance}, and the base for anything further out. Items added
     * since the last {@link recalculateItemCenters} have no cached centre and are
     * skipped rather than mis-sized.
     */
    updateItems(): void {
        const items = this.allItems;
        if (items.length === 0) return;

        const magnification = this.magnification();
        const distance = this.distance();
        const baseWidth = 40;

        items.forEach((item, index) => {
            if (index >= this._itemCenters.length) return;
            const center = this._itemCenters[index];

            const dist = this._pointerOffset - center;
            let width = baseWidth;

            if (this._pointerOffset !== Infinity && Math.abs(dist) < distance) {
                const val = Math.abs(dist);
                const weights = Math.cos((val / distance) * (Math.PI / 2));
                width = baseWidth + (magnification - baseWidth) * weights;
            }

            item.updateWidth(width);
        });
    }
}

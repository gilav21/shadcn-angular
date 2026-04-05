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
import { cn } from '../lib/utils';
import { DockItemComponent } from './dock-item.component';
import { DockIconComponent } from './dock-icon.component';
import { DockLabelComponent } from './dock-label.component';

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
    template: `
    <div
      #dock
      [class]="classes()"
      [attr.data-slot]="'dock'"
    >
      @if (hasCustomContent()) {
        <ng-content />
      } @else {
        @for (item of items(); track $index) {
          <ui-dock-item [class]="item.class || ''" [active]="item.active || false">
            @if (item.label) { <ui-dock-label>{{ item.label }}</ui-dock-label> }
            @if (item.icon) { <ui-dock-icon>{{ item.icon }}</ui-dock-icon> }
          </ui-dock-item>
        }
      }
    </div>
  `,
    host: { class: 'contents' },
})
export class DockComponent implements OnInit, OnDestroy, AfterContentInit, AfterViewInit {
    class = input('');
    magnification = input<number>(60);
    distance = input<number>(100);
    position = input<'bottom' | 'top' | 'left' | 'right'>('bottom');
    items = input<DockItemData[]>([]);

    @ContentChildren(DockItemComponent) private readonly projectedItems!: QueryList<DockItemComponent>;
    @ViewChildren(DockItemComponent) private readonly viewItems!: QueryList<DockItemComponent>;

    private readonly _hasCustomContent = signal(false);
    hasCustomContent = this._hasCustomContent.asReadonly();

    ngAfterContentInit() {
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

    ngAfterViewInit() {
        this.recalculateItemCenters();
    }

    ngOnInit() {
        this._ngZone.runOutsideAngular(() => {
            this._el.nativeElement.addEventListener('mousemove', this.onMouseMoveBound);
            this._el.nativeElement.addEventListener('mouseleave', this.onMouseLeaveBound);
            this._el.nativeElement.addEventListener('mouseenter', this.onMouseEnterBound);
        });
    }

    ngOnDestroy() {
        this._el.nativeElement.removeEventListener('mousemove', this.onMouseMoveBound);
        this._el.nativeElement.removeEventListener('mouseleave', this.onMouseLeaveBound);
        this._el.nativeElement.removeEventListener('mouseenter', this.onMouseEnterBound);
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    private _rafId: number | null = null;
    private _mouseX: number = Infinity;

    onMouseEnter() {
        this.recalculateItemCenters();
    }

    recalculateItemCenters() {
        this._itemCenters = this.allItems.map(item => item.getCenter());
    }

    onMouseMove(e: MouseEvent) {
        this._mouseX = e.clientX;

        if (this._rafId) return;

        this._rafId = requestAnimationFrame(() => {
            this.updateItems();
            this._rafId = null;
        });
    }

    onMouseLeave() {
        this._mouseX = Infinity;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this.updateItems();
    }

    updateItems() {
        const items = this.allItems;
        if (items.length === 0) return;

        const magnification = this.magnification();
        const distance = this.distance();
        const baseWidth = 40;

        items.forEach((item, index) => {
            const centerX = this._itemCenters[index];
            if (centerX === undefined) return;

            const dist = this._mouseX - centerX;
            let width = baseWidth;

            if (this._mouseX !== Infinity && Math.abs(dist) < distance) {
                const val = Math.abs(dist);
                const weights = Math.cos((val / distance) * (Math.PI / 2));
                width = baseWidth + (magnification - baseWidth) * weights;
            }

            item.updateWidth(width);
        });
    }
}

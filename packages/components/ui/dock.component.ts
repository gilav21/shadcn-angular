import {
    Component,
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
    AfterViewInit,
    ViewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { cva, VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { DockItemComponent } from './dock-item.component';
import { DockIconComponent } from './dock-icon.component';
import { DockLabelComponent } from './dock-label.component';

const dockVariants = cva(
    'mx-auto w-max mt-8 h-[58px] p-2 flex gap-2 rounded-2xl border supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 backdrop-blur-md',
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
}

@Component({
    selector: 'ui-dock',
    standalone: true,
    imports: [CommonModule, DockItemComponent, DockIconComponent, DockLabelComponent],
    template: `
    <div
      #dock
      [class]="classes()"
    >
      <ng-content />
      @for (item of items(); track $index) {
        <ui-dock-item [class]="item.class || ''" [active]="item.active || false">
           @if (item.label) { <ui-dock-label>{{ item.label }}</ui-dock-label> }
           @if (item.icon) { <ui-dock-icon>{{ item.icon }}</ui-dock-icon> }
        </ui-dock-item>
      }
    </div>
  `,
    host: {
        'class': 'block w-full'
    }
})
export class DockComponent implements OnInit, OnDestroy, AfterViewInit {
    class = input<string>('');
    magnification = input<number>(60);
    distance = input<number>(100);
    position = input<'bottom' | 'top' | 'left' | 'right'>('bottom');
    items = input<DockItemData[]>([]);



    classes = computed(() => cn(dockVariants({ position: this.position() }), this.class()));

    private _el = inject(ElementRef);
    private _ngZone = inject(NgZone);

    @ContentChildren(DockItemComponent) private projectedItems!: QueryList<DockItemComponent>;
    @ViewChildren(DockItemComponent) private viewItems!: QueryList<DockItemComponent>;

    private _itemCenters: number[] = [];

    private get allItems(): DockItemComponent[] {
        return [...(this.projectedItems?.toArray() || []), ...(this.viewItems?.toArray() || [])];
    }

    ngAfterViewInit() {
        // Initial setup
        this.recalculateItemCenters();
    }

    ngOnInit() {
        this._ngZone.runOutsideAngular(() => {
            this._el.nativeElement.addEventListener('mousemove', this.onMouseMove.bind(this));
            this._el.nativeElement.addEventListener('mouseleave', this.onMouseLeave.bind(this));
            this._el.nativeElement.addEventListener('mouseenter', this.onMouseEnter.bind(this));
        });
    }

    ngOnDestroy() {
        this._el.nativeElement.removeEventListener('mousemove', this.onMouseMove.bind(this));
        this._el.nativeElement.removeEventListener('mouseleave', this.onMouseLeave.bind(this));
        this._el.nativeElement.removeEventListener('mouseenter', this.onMouseEnter.bind(this));
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
        // One last update to reset
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

import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
    effect,
    ComponentRef,
    OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BentoGridComponent, DashboardItem } from '../bento-grid.component';
import { PageData, ComponentMeta } from './page-builder.types';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-page-renderer',
    standalone: true,
    imports: [
        CommonModule,
        BentoGridComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="classes()">
            <ui-bento-grid
                [items]="dashboardItems()"
                [cols]="gridCols()"
                [rowHeight]="gridRowHeight()"
                [columnWidth]="gridColumnWidth()"
                [gap]="gridGap()"
                [showBorders]="gridShowBorders()"
                [borderRadius]="gridBorderRadius()"
                [itemPadding]="gridItemPadding()"
                [editable]="false"
                (componentInit)="onComponentInit($event)"
            >
            </ui-bento-grid>
        </div>
    `,
    host: { class: 'block' }
})
export class PageRendererComponent implements OnDestroy {
    data = input.required<PageData>();
    components = input<ComponentMeta[]>([]);
    context = input<Record<string, any>>({});
    class = input('');

    private instanceMap = new Map<string, any>();

    classes = computed(() => cn('w-full h-full', this.class()));

    gridCols = computed(() => this.data().grid.cols);
    gridRowHeight = computed(() => this.data().grid.rowHeight);
    gridColumnWidth = computed(() => this.data().grid.columnWidth);
    gridGap = computed(() => this.data().grid.gap);
    gridShowBorders = computed(() => this.data().grid.showBorders);
    gridBorderRadius = computed(() => this.data().grid.borderRadius);
    gridItemPadding = computed(() => this.data().grid.itemPadding);

    dashboardItems = computed(() => {
        const pageItems = this.data().items;
        const metaList = this.components();
        const ctx = this.context();

        return pageItems.map(item => {
            const meta = metaList.find(c => c.id === item.componentId);
            if (!meta) return null;

            const resolvedInputs = { ...item.inputs };

            if (item.bindings) {
                Object.entries(item.bindings).forEach(([prop, path]) => {
                    const value = this.resolvePath(ctx, path);
                    if (value !== undefined) {
                        resolvedInputs[prop] = value;
                    }
                });
            }

            return {
                id: item.id,
                x: item.x,
                y: item.y,
                cols: item.cols,
                rows: item.rows,
                content: meta.component,
                inputs: resolvedInputs
            } as DashboardItem;
        }).filter((item): item is DashboardItem => item !== null);
    });

    constructor() {
        effect(() => {
            const items = this.dashboardItems();
            this.updateInstances(items);
        });
    }

    onComponentInit(event: { id: string, ref: ComponentRef<any> }) {
        this.instanceMap.set(event.id, event.ref.instance);
        const item = this.dashboardItems().find(i => i.id === event.id);
        if (item) {
            this.updateInstance(event.ref.instance, item.inputs);
        }
    }

    private updateInstances(items: DashboardItem[]) {
        items.forEach(item => {
            const instance = this.instanceMap.get(item.id);
            if (instance) {
                this.updateInstance(instance, item.inputs);
            }
        });
    }

    private updateInstance(instance: any, inputs: Record<string, any> | undefined) {
        if (!inputs) return;
        Object.entries(inputs).forEach(([key, value]) => {
            if (typeof instance[key] === 'object' && instance[key]?.set && typeof instance[key].set === 'function') {
                // It's likely a signal input, but we can't easily know for sure without reflection.
                // However, Angular inputs are set by the framework. 
                // BentoGrid uses *ngComponentOutlet which handles inputs if passed correctly in the injector or inputs object.
                // But BentoGrid currently passes inputs via `componentRef.setInput`.
                // The `dashboardItems` computed signal returns new objects with new inputs.
                // BentoGrid detects this change and re-renders or updates inputs.
                // We might not need to manually update instances if BentoGrid handles `OnChanges` or `setInput`.
                // Let's rely on BentoGrid's input handling mechanism which reacts to `items()` changes.
            }
        });
    }

    private resolvePath(obj: any, path: string): any {
        if (!path) return undefined;
        const keys = path.split('.');
        let current = obj;

        for (const key of keys) {
            if (current === undefined || current === null) return undefined;
            current = current[key];
        }
        return current;
    }

    ngOnDestroy() {
        this.instanceMap.clear();
    }
}

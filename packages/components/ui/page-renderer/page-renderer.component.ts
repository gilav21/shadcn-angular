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
import { BentoGridComponent, DashboardItem } from '../bento-grid';
import { PageData, ComponentMeta } from '../../lib/page-builder.types';
import { cn } from '../../lib/utils';

@Component({
    selector: 'ui-page-renderer',
    standalone: true,
    imports: [
        CommonModule,
        BentoGridComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './page-renderer.component.html',
    host: { class: 'block' }
})
export class PageRendererComponent implements OnDestroy {
    data = input.required<PageData>();
    components = input<ComponentMeta[]>([]);
    context = input<Record<string, unknown>>({});
    class = input('');

    private readonly instanceMap = new Map<string, Record<string, unknown>>();

    classes = computed(() => cn('w-full h-full', this.class()));

    gridCols = computed(() => this.data().grid.cols);
    gridRowHeight = computed(() => this.data().grid.rowHeight);
    gridColumnWidth = computed(() => this.data().grid.columnWidth);
    gridGap = computed(() => this.data().grid.gap);
    gridShowBorders = computed(() => this.data().grid.showBorders ?? true);
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
            } satisfies DashboardItem;
        }).filter((item): item is DashboardItem => item !== null);
    });

    constructor() {
        effect(() => {
            const items = this.dashboardItems();
            this.updateInstances(items);
        });
    }

    onComponentInit(event: { id: string, ref: ComponentRef<unknown> }): void {
        const instance = event.ref.instance as Record<string, unknown>;
        this.instanceMap.set(event.id, instance);
        const item = this.dashboardItems().find(i => i.id === event.id);
        if (item) {
            this.updateInstance(instance, item.inputs);
        }
    }

    private updateInstances(items: DashboardItem[]): void {
        items.forEach(item => {
            const instance = this.instanceMap.get(item.id);
            if (instance) {
                this.updateInstance(instance, item.inputs);
            }
        });
    }

    private updateInstance(instance: Record<string, unknown>, inputs: Record<string, unknown> | undefined): void {
        if (!inputs) return;
        Object.entries(inputs).forEach(([_key, _value]) => {
            // Angular inputs are set by the framework via BentoGrid's setInput mechanism.
            // BentoGrid detects dashboardItems() changes and re-renders / updates inputs.
        });
    }

    private resolvePath(obj: Record<string, unknown>, path: string): unknown {
        if (!path) return undefined;
        const keys = path.split('.');
        let current: unknown = obj;

        for (const key of keys) {
            if (current === undefined || current === null) return undefined;
            current = (current as Record<string, unknown>)[key];
        }
        return current;
    }

    ngOnDestroy(): void {
        this.instanceMap.clear();
    }
}

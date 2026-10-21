import {
    Component,
    ChangeDetectionStrategy,
    input,
    computed,
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
export class PageRendererComponent {
    /**
     * Saved page document to render: the grid configuration plus the placed
     * items. This is the read-only runtime counterpart of what the page builder
     * produces — nothing here is editable or draggable.
     */
    data = input.required<PageData>();
    /**
     * Catalogue used to resolve each item's `componentId` to an actual Angular
     * component class. Items whose id is missing from this list are silently
     * dropped, so an incomplete catalogue shows a partial page rather than
     * throwing.
     */
    components = input<ComponentMeta[]>([]);
    /**
     * Data source for item `bindings`: each binding maps a component input name
     * to a dot-path looked up in this object, and a resolved value overrides the
     * item's static input. Paths that resolve to `undefined` leave the static
     * value untouched.
     */
    context = input<Record<string, unknown>>({});
    /** Extra classes merged onto the `w-full h-full` grid wrapper — usually where you constrain the rendered page's size. */
    class = input('');

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
            } as DashboardItem;
        }).filter((item): item is DashboardItem => item !== null);
    });

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
}

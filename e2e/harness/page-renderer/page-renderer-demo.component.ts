import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PageRendererComponent } from '@/components/ui/page-renderer';
import type { PageData, ComponentMeta } from '@/components/lib/page-builder.types';

/** A locally-registered tile so the renderer has something to instantiate. */
@Component({
    selector: 'app-tile',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<div class="tile rounded-md border p-2">{{ label() }}</div>`,
})
export class TileComponent {
    readonly label = input('tile');
}

/** Harness for the `page-renderer` component (renders serialized page JSON). */
@Component({
    selector: 'app-page-renderer-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [PageRendererComponent],
    template: `
        <main class="p-8">
            <ui-page-renderer
                data-testid="root"
                class="block"
                [data]="data"
                [components]="components"
            />
        </main>
    `,
})
export class PageRendererDemoComponent {
    protected readonly components: ComponentMeta[] = [
        {
            id: 'tile',
            name: 'Tile',
            category: 'display',
            component: TileComponent,
            defaultInputs: { label: 'tile' },
        },
    ];

    protected readonly data: PageData = {
        grid: {
            cols: 12,
            rowHeight: '60px',
            columnWidth: '1fr',
            gap: '8px',
            borderRadius: '8px',
            itemPadding: '8px',
        },
        items: [
            { id: 'a', x: 0, y: 0, cols: 3, rows: 1, componentId: 'tile', inputs: { label: 'Alpha' } },
            { id: 'b', x: 3, y: 0, cols: 3, rows: 1, componentId: 'tile', inputs: { label: 'Beta' } },
        ],
    };
}

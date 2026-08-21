import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
    InfiniteCanvasComponent,
    InfiniteCanvasItemDirective,
    type CanvasEdge,
    type CanvasItem,
} from '@/components/ui/infinite-canvas';

interface HarnessNode extends CanvasItem {
    label: string;
}

const COLUMNS = 100;
const COUNT = 10_000;

function buildNodes(): HarnessNode[] {
    return Array.from({ length: COUNT }, (_, i) => ({
        id: i,
        x: (i % COLUMNS) * 240,
        y: Math.floor(i / COLUMNS) * 160,
        width: 160,
        height: 90,
        label: `Node ${i}`,
    }));
}

function buildEdges(): CanvasEdge[] {
    const edges: CanvasEdge[] = [];
    for (let i = 0; i < COUNT - 1; i++) {
        if ((i + 1) % COLUMNS !== 0) edges.push({ id: `h-${i}`, source: i, target: i + 1 });
    }
    return edges;
}

/**
 * Harness for the `infinite-canvas` component.
 *
 * Loads the full 10,000-item budget so the e2e run proves what unit tests
 * cannot: that a real consumer install renders a huge graph with a bounded
 * element count, and that pan and zoom work through actual browser input.
 */
@Component({
    selector: 'app-infinite-canvas-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [InfiniteCanvasComponent, InfiniteCanvasItemDirective],
    template: `
        <main class="p-8">
            <div class="flex flex-wrap items-center gap-2 pb-4">
                <button type="button" data-testid="fit" (click)="canvas()?.fitView()">Fit</button>
                <button type="button" data-testid="reset" (click)="canvas()?.resetView()">Reset</button>
                <button type="button" data-testid="zoom-in" (click)="canvas()?.zoomBy(2)">Zoom in</button>
                <span data-testid="zoom">{{ zoom() }}</span>
            </div>

            <div class="w-full border" style="height: 600px">
                <ui-infinite-canvas
                    #canvasRef="uiInfiniteCanvas"
                    data-testid="root"
                    class="h-full w-full"
                    [items]="items()"
                    [edges]="edges()"
                    ariaLabel="Harness canvas"
                    (viewportChange)="zoom.set($event.zoom.toFixed(3))"
                >
                    <ng-template uiInfiniteCanvasItem [ofType]="items()" let-item>
                        <div class="h-full w-full rounded border bg-white p-2 text-xs">{{ item.label }}</div>
                    </ng-template>
                </ui-infinite-canvas>
            </div>
        </main>
    `,
})
export class InfiniteCanvasDemoComponent {
    readonly canvas = viewChild<InfiniteCanvasComponent<HarnessNode>>('canvasRef');
    readonly items = signal<HarnessNode[]>(buildNodes());
    readonly edges = signal<CanvasEdge[]>(buildEdges());
    readonly zoom = signal('1.000');
}

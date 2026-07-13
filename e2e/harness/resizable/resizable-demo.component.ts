import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    ResizablePanelGroupComponent,
    ResizablePanelComponent,
    ResizableHandleComponent,
} from '@/components/ui/resizable';

/**
 * Harness for the `resizable` component. The root element is
 * `ui-resizable-panel-group` (there is no `ui-resizable` element).
 */
@Component({
    selector: 'app-resizable-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ResizablePanelGroupComponent, ResizablePanelComponent, ResizableHandleComponent],
    template: `
        <main class="p-8">
            <div data-testid="root" class="h-48 w-[600px] rounded-md border">
                <ui-resizable-panel-group direction="horizontal" class="h-48">
                    <ui-resizable-panel data-testid="resizable-panel" [defaultSize]="50">
                        <div class="p-4">Left</div>
                    </ui-resizable-panel>
                    <ui-resizable-handle data-testid="resizable-handle" [withHandle]="true" />
                    <ui-resizable-panel data-testid="resizable-panel-2" [defaultSize]="50">
                        <div class="p-4">Right</div>
                    </ui-resizable-panel>
                </ui-resizable-panel-group>
            </div>
        </main>
    `,
})
export class ResizableDemoComponent {}

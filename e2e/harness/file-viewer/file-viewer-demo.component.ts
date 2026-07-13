import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FileViewerComponent } from '@/components/ui/file-viewer';

/**
 * Auto-generated harness for the `file-viewer` component.
 * Extend the template and assertions in `file-viewer.spec.ts` as needed.
 */
@Component({
    selector: 'app-file-viewer-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FileViewerComponent],
    template: `
        <main class="p-8">
            <ui-file-viewer data-testid="root"></ui-file-viewer>
        </main>
    `,
})
export class FileViewerDemoComponent {}

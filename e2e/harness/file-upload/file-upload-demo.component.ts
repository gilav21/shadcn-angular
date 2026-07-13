import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FileUploadComponent } from '@/components/ui/file-upload';

/**
 * Auto-generated harness for the `file-upload` component.
 * Extend the template and assertions in `file-upload.spec.ts` as needed.
 */
@Component({
    selector: 'app-file-upload-demo',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FileUploadComponent],
    template: `
        <main class="p-8">
            <ui-file-upload data-testid="root"></ui-file-upload>
        </main>
    `,
})
export class FileUploadDemoComponent {}

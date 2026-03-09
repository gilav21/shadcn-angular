import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FileUploadComponent } from '../../../../../packages/components/ui';

@Component({
  selector: 'app-file-upload-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FileUploadComponent],
  template: `
    <section class="space-y-4">
      <h2 id="file-upload" class="text-2xl font-semibold scroll-m-20">File Upload</h2>
      <p class="text-muted-foreground">
        A drag-and-drop zone with file list preview, progress bars, and remove actions.
      </p>

      <div class="max-w-md">
        <ui-file-upload accept="image/*,.pdf" [multiple]="true" [maxFiles]="5" [maxSize]="5242880" />
      </div>
    </section>
  `,
})
export class FileUploadDemoComponent {}

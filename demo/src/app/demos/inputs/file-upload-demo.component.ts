import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { FileUploadComponent } from '../../../../../packages/components/ui';
import { FILE_UPLOAD_DEMO_LOCALES } from './file-upload-demo.locales';

@Component({
  selector: 'app-file-upload-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FileUploadComponent],
  template: `
    <section class="space-y-4">
      <h2 id="file-upload" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <div class="max-w-md">
        <ui-file-upload accept="image/*,.pdf" [multiple]="true" [maxFiles]="5" [maxSize]="5242880" />
      </div>

      <div class="max-w-md space-y-2">
        <p class="text-sm font-medium">{{ t().maxFilesHeading }}</p>
        <ui-file-upload [multiple]="true" [maxFiles]="2" (fileError)="onFileError($event)" />
        <p class="text-sm text-muted-foreground">{{ t().maxFilesCaption }}</p>
        <div class="space-y-1">
          <p class="text-sm font-medium">{{ t().refusedHeading }}</p>
          @if (refusedFiles().length) {
            <ul class="space-y-1 text-sm text-destructive">
              @for (refused of refusedFiles(); track refused.id) {
                <li>{{ refused.name }} — {{ refused.error }}</li>
              }
            </ul>
          } @else {
            <p class="text-sm text-muted-foreground">{{ t().noRefused }}</p>
          }
        </div>
      </div>
    </section>
  `,
})
export class FileUploadDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => FILE_UPLOAD_DEMO_LOCALES[this.localeId()] ?? FILE_UPLOAD_DEMO_LOCALES['en']);

  private nextRefusedId = 0;

  /** Files the component refused, as reported by `(fileError)` — nothing renders them otherwise. */
  protected readonly refusedFiles = signal<{ id: number; name: string; error: string }[]>([]);

  /** Records a refusal so the reason for a dropped-but-missing file is visible. */
  protected onFileError(event: { file: File; error: string }): void {
    this.nextRefusedId += 1;
    const entry = { id: this.nextRefusedId, name: event.file.name, error: event.error };
    this.refusedFiles.update((list) => [entry, ...list].slice(0, 5));
  }
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
    </section>
  `,
})
export class FileUploadDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => FILE_UPLOAD_DEMO_LOCALES[this.localeId()] ?? FILE_UPLOAD_DEMO_LOCALES['en']);
}

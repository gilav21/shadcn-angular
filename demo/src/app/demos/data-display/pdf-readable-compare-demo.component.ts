import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { ButtonComponent } from '../../../../../packages/components/ui';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { PDF_READABLE_COMPARE_DEMO_LOCALES } from './pdf-readable-compare-demo.locales';

/**
 * Validation harness for the pdf-readable pipeline: renders a chosen PDF as
 * clean flowing semantic HTML (left) beside the pixel-perfect reference
 * render (right) so layout fidelity can be judged page by page.
 */
@Component({
  selector: 'app-pdf-readable-compare-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  template: `
    <section class="space-y-6">
      <h2 id="pdf-readable-compare" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground max-w-2xl">{{ t().description }}</p>

      <div class="flex flex-wrap items-center gap-2">
        <ui-button (click)="fileInput.click()">{{ t().pickFile }}</ui-button>
        <input #fileInput type="file" accept="application/pdf,.pdf" class="hidden"
          (change)="onFileSelected($event)" />
        @if (fileName()) {
          <span class="text-sm text-muted-foreground">{{ fileName() }}</span>
        }
      </div>

      @if (error()) {
        <p class="text-destructive text-sm">{{ t().error }}{{ error() }}</p>
      } @else if (!readableHtml()) {
        <p class="text-muted-foreground text-sm">{{ t().empty }}</p>
      } @else {
        <div class="grid gap-4 lg:grid-cols-2">
          <div class="min-w-0">
            <h3 class="mb-2 text-lg font-medium">{{ t().readableHeading }}</h3>
            <div class="rounded-md border bg-white p-4 sm:p-6 text-black overflow-auto max-h-[70vh]"
              [innerHTML]="readableHtml()"></div>
          </div>
          <div class="min-w-0">
            <h3 class="mb-2 text-lg font-medium">{{ t().referenceHeading }}</h3>
            <div class="rounded-md border overflow-auto max-h-[70vh]"
              [innerHTML]="referenceHtml()"></div>
          </div>
        </div>
      }
    </section>
  `,
})
export class PdfReadableCompareDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly t = computed(
    () => PDF_READABLE_COMPARE_DEMO_LOCALES[this.localeId()] ?? PDF_READABLE_COMPARE_DEMO_LOCALES['en'],
  );

  protected readonly fileName = signal('');
  protected readonly error = signal('');
  protected readonly readableHtml = signal<SafeHtml | null>(null);
  protected readonly referenceHtml = signal<SafeHtml | null>(null);

  protected async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.error.set('');
    this.readableHtml.set(null);
    this.referenceHtml.set(null);
    try {
      const buffer = await file.arrayBuffer();
      await this.renderBoth(buffer);
    } catch (e: unknown) {
      this.error.set(e instanceof Error ? e.message : String(e));
    }
  }

  private async renderBoth(buffer: ArrayBuffer): Promise<void> {
    const { parsePdfReadable } = await import('../../../../../packages/components/lib/parsers/pdf-readable/pdf-readable');
    const readable = await parsePdfReadable(buffer);
    this.readableHtml.set(this.sanitizer.bypassSecurityTrustHtml(
      `<style>${readable.fontFaceCss}</style>${readable.html}`));

    const { renderPixelPerfectPaged } = await import('../../../../../packages/components/lib/parsers/pdf-pixel-perfect');
    const reference = await renderPixelPerfectPaged(buffer.slice(0));
    const pages = reference.pages.map(p => p.html).join('\n');
    this.referenceHtml.set(this.sanitizer.bypassSecurityTrustHtml(
      `<style>${reference.globalCss}</style>${pages}`));
  }
}

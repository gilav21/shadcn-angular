import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
    extractDominantColors,
    type ExtractAlgorithm,
} from '../../../../../packages/components/lib/color-extract';
import { formatHex } from '../../../../../packages/components/lib/color';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { IMAGE_EXTRACT_DEMO_LOCALES } from './image-extract-demo.locales';

@Component({
    selector: 'app-image-extract-demo',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <section class="space-y-6">
      <h2 id="image-extract" class="text-2xl font-semibold scroll-m-20">{{ t().heading }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <article class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <label class="text-sm">
            {{ t().algorithmLabel }}
            <select
              class="ml-2 rounded border border-input bg-background px-2 py-1 text-sm"
              [value]="algorithm()"
              (change)="onAlgorithmChange($event)"
            >
              <option value="median-cut">median-cut</option>
              <option value="k-means">k-means</option>
            </select>
          </label>
          <label class="text-sm">
            {{ t().countLabel }}
            <input
              type="number"
              min="2"
              max="12"
              class="ml-2 w-16 rounded border border-input bg-background px-2 py-1 text-sm"
              [value]="count()"
              (input)="onCountChange($event)"
            />
          </label>
          <input
            type="file"
            accept="image/*"
            class="text-sm"
            (change)="onFileSelected($event)"
          />
        </div>

        @if (preview()) {
          <div class="flex items-start gap-4">
            <img [src]="preview()" [alt]="t().imgAlt" class="max-w-xs rounded-md" />
            <div class="space-y-2">
              <p class="text-sm text-muted-foreground">{{ t().paletteLabel }}</p>
              <div class="flex flex-wrap gap-2">
                @for (color of palette(); track color) {
                  <div class="flex flex-col items-center gap-1">
                    <span class="h-12 w-12 rounded border" [style.backgroundColor]="color"></span>
                    <code class="text-xs font-mono">{{ color }}</code>
                  </div>
                }
              </div>
            </div>
          </div>
        } @else {
          <p class="text-sm text-muted-foreground">{{ t().emptyPrompt }}</p>
        }
      </article>
    </section>
  `,
})
export class ImageExtractDemoComponent {
    private readonly localeId = inject(UI_LOCALE_ID);
    protected readonly t = computed(() => IMAGE_EXTRACT_DEMO_LOCALES[this.localeId()] ?? IMAGE_EXTRACT_DEMO_LOCALES['en']);

    readonly algorithm = signal<ExtractAlgorithm>('median-cut');
    readonly count = signal(6);
    readonly preview = signal<string | null>(null);
    readonly palette = signal<string[]>([]);

    onAlgorithmChange(event: Event): void {
        const select = event.target as HTMLSelectElement;
        this.algorithm.set(select.value as ExtractAlgorithm);
        void this.recompute();
    }

    onCountChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const n = Math.max(2, Math.min(12, +input.value));
        this.count.set(n);
        void this.recompute();
    }

    private currentFile: File | null = null;

    async onFileSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        this.currentFile = file;
        this.preview.set(URL.createObjectURL(file));
        await this.recompute();
    }

    private async recompute(): Promise<void> {
        if (!this.currentFile) return;
        try {
            const result = await extractDominantColors(this.currentFile, {
                algorithm: this.algorithm(),
                count: this.count(),
            });
            this.palette.set(result.map(c => formatHex(c)));
        } catch {
            this.palette.set([]);
        }
    }
}

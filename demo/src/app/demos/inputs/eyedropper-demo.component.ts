import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { UI_LOCALE_ID } from '../../../../../packages/components/lib/i18n';
import { EyedropperComponent } from '../../../../../packages/components/ui';
import { EYEDROPPER_DEMO_LOCALES } from './eyedropper-demo.locales';

@Component({
  selector: 'app-eyedropper-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EyedropperComponent],
  template: `
    <section class="space-y-6">
      <h2 id="eyedropper" class="text-2xl font-semibold scroll-m-20">{{ t().title }}</h2>
      <p class="text-muted-foreground">{{ t().description }}</p>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">{{ t().sections.nativeApi }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().sections.nativeApiDesc }}</p>
        <div class="flex items-center gap-4">
          <ui-eyedropper variant="button" [label]="t().buttons.pickPixel" (colorPick)="nativePicked.set($event)" />
          @if (nativePicked()) {
            <div class="flex items-center gap-2">
              <span class="h-8 w-8 rounded border" [style.backgroundColor]="nativePicked()"></span>
              <code class="text-sm font-mono">{{ nativePicked() }}</code>
            </div>
          }
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">{{ t().sections.inPageFallback }}</h3>
        <p class="text-sm text-muted-foreground">{{ t().sections.inPageFallbackDesc }}</p>
        <div class="flex items-start gap-4">
          <img
            #target
            src="https://picsum.photos/seed/eyedropper-demo/320/200"
            alt="Sample"
            crossorigin="anonymous"
            class="rounded-md"
          />
          <div class="flex flex-col gap-3">
            <ui-eyedropper variant="button" [label]="t().buttons.sampleFromImage" [fallbackTarget]="target" (colorPick)="fallbackPicked.set($event)" />
            @if (fallbackPicked()) {
              <div class="flex items-center gap-2">
                <span class="h-8 w-8 rounded border" [style.backgroundColor]="fallbackPicked()"></span>
                <code class="text-sm font-mono">{{ fallbackPicked() }}</code>
              </div>
            }
          </div>
        </div>
      </article>

      <article class="space-y-2">
        <h3 class="text-lg font-semibold">{{ t().sections.disabled }}</h3>
        <ui-eyedropper variant="icon" [disabled]="true" />
      </article>
    </section>
  `,
})
export class EyedropperDemoComponent {
  private readonly localeId = inject(UI_LOCALE_ID);
  protected readonly t = computed(() => EYEDROPPER_DEMO_LOCALES[this.localeId()] ?? EYEDROPPER_DEMO_LOCALES['en']);

  readonly nativePicked = signal<string | null>(null);
  readonly fallbackPicked = signal<string | null>(null);
  readonly target = viewChild<ElementRef<HTMLImageElement>>('target');
}
